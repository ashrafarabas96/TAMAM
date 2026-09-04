import { AccountStatus, ChaletBookingStatus, UserRole } from '@tamam/shared-types';

import type { RequestUser } from '../src/common/types/request-user';
import { ChaletBookingService } from '../src/modules/chalet/chalet-booking.service';

import { TestApp } from './helpers/app';
import { createChaletCustomer, createChaletFixture } from './helpers/chalet';

/**
 * Spec §9 and §75 Test 1 — double booking must be impossible.
 *
 * The availability check is advisory by design: two customers can both be told
 * a slot is free, because between the check and the write anything can happen.
 * What must hold is that only one of them ends up with the booking, and that
 * the other gets a clean answer rather than a stack trace.
 *
 * This runs against the real database, so it exercises the actual guard: a
 * transaction ending in a write the exclusion constraint can reject.
 */
describe('Chalet double-booking (§9, §75)', () => {
  let api: TestApp;
  let bookings: ChaletBookingService;
  let chaletId: string;
  let ownerId: string;

  const asUser = (id: string): { user: RequestUser } => ({
    user: {
      id,
      phone: '+970599000000',
      roles: [UserRole.CUSTOMER],
      permissions: [],
      accountStatus: AccountStatus.ACTIVE,
      sessionId: 'e2e',
      deviceId: 'e2e',
      language: 'ar',
      customerId: id,
      isSuperAdmin: false,
    },
  });

  /** Tomorrow at a fixed local hour, so the test never fights the wall clock. */
  const slotAt = (hour: number, minute = 0): string => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() + 1);
    at.setUTCHours(hour, minute, 0, 0);
    return at.toISOString();
  };

  beforeAll(async () => {
    api = await TestApp.boot();
    bookings = api.app.get(ChaletBookingService);
    const fixture = await createChaletFixture(api.prisma);
    chaletId = fixture.chaletId;
    ownerId = fixture.ownerId;
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.prisma.chaletBooking.deleteMany({ where: { chaletId } });
  });

  it('lets exactly one of two simultaneous holds win', async () => {
    const [first, second] = await Promise.all([
      createChaletCustomer(api.prisma),
      createChaletCustomer(api.prisma),
    ]);

    const slot = { chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 };
    const results = await Promise.allSettled([
      bookings.hold(asUser(first as string), slot),
      bookings.hold(asUser(second as string), slot),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const rows = await api.prisma.chaletBooking.findMany({
      where: { chaletId, status: { in: [ChaletBookingStatus.HELD, ChaletBookingStatus.CONFIRMED] } },
    });
    expect(rows).toHaveLength(1);
  }, 60_000);

  it('tells the loser something they can act on', async () => {
    const customer = await createChaletCustomer(api.prisma);
    const rival = await createChaletCustomer(api.prisma);
    const slot = { chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 };

    await bookings.hold(asUser(customer), slot);
    await expect(bookings.hold(asUser(rival), slot)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  }, 60_000);

  it('keeps the cleaning window occupied after the booking ends', async () => {
    const customer = await createChaletCustomer(api.prisma);
    const rival = await createChaletCustomer(api.prisma);

    // 09:00-13:00 plus ninety minutes of cleaning blocks until 14:30.
    await bookings.hold(asUser(customer), {
      chaletId,
      startAt: slotAt(9),
      endAt: slotAt(13),
      guestCount: 4,
    });

    await expect(
      bookings.hold(asUser(rival), {
        chaletId,
        startAt: slotAt(13),
        endAt: slotAt(16),
        guestCount: 4,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const later = await bookings.hold(asUser(rival), {
      chaletId,
      startAt: slotAt(14, 30),
      endAt: slotAt(17),
      guestCount: 4,
    });
    expect(later.status).toBe(ChaletBookingStatus.HELD);
  }, 60_000);

  it('derives blockedUntil in the database rather than trusting the caller', async () => {
    const customer = await createChaletCustomer(api.prisma);
    const booking = await bookings.hold(asUser(customer), {
      chaletId,
      startAt: slotAt(9),
      endAt: slotAt(13),
      guestCount: 4,
    });
    const stored = await api.prisma.chaletBooking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(stored.blockedUntil.getTime() - stored.endAt.getTime()).toBe(90 * 60_000);
    expect(stored.bookingDurationMinutes).toBe(240);
  }, 60_000);

  it('frees the slot once a booking is cancelled', async () => {
    const customer = await createChaletCustomer(api.prisma);
    const rival = await createChaletCustomer(api.prisma);
    const slot = { chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 };

    const held = await bookings.hold(asUser(customer), slot);
    await bookings.confirm(asUser(customer), held.id);
    await bookings.cancel(asUser(customer), held.id, { reason: 'تغيّرت خططنا' });

    const retaken = await bookings.hold(asUser(rival), slot);
    expect(retaken.status).toBe(ChaletBookingStatus.HELD);
  }, 60_000);

  it('stops an owner double-booking their own calendar from another channel', async () => {
    const customer = await createChaletCustomer(api.prisma);
    await bookings.hold(asUser(customer), {
      chaletId,
      startAt: slotAt(9),
      endAt: slotAt(13),
      guestCount: 4,
    });

    await expect(
      bookings.createExternal(asUser(ownerId), chaletId, {
        startAt: slotAt(11),
        endAt: slotAt(15),
        guestCount: 4,
        guestName: 'أبو محمد',
        source: 'OWNER_MANUAL',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  }, 60_000);

  it('lets an owner record a booking on a free window, occupying it like any other', async () => {
    const rival = await createChaletCustomer(api.prisma);
    const external = await bookings.createExternal(asUser(ownerId), chaletId, {
      startAt: slotAt(9),
      endAt: slotAt(13),
      guestCount: 4,
      guestName: 'أبو محمد',
      source: 'OWNER_MANUAL',
    });
    expect(external.status).toBe(ChaletBookingStatus.CONFIRMED);
    expect(external.customerId).toBeNull();

    await expect(
      bookings.hold(asUser(rival), {
        chaletId,
        startAt: slotAt(10),
        endAt: slotAt(12),
        guestCount: 2,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  }, 60_000);
});
