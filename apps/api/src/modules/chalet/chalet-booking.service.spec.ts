import { Prisma } from '@prisma/client';
import {
  AccountStatus,
  ChaletBookingStatus,
  ErrorCode,
  UserRole,
} from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { AppConfigService } from '../../config';
import type { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';

import type { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletBookingService, formatBookingNumber, isOverlapRejection } from './chalet-booking.service';
import type { ChaletPricingService } from './chalet-pricing.service';

const CHALET_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '44444444-4444-4444-8444-444444444444';
const TZ = 'Asia/Jerusalem';

const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

function user(id: string, overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id,
    phone: '+970599000001',
    roles: [UserRole.CUSTOMER],
    permissions: [],
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    language: 'ar',
    customerId: id,
    isSuperAdmin: false,
    ...overrides,
  };
}

interface BookingRow {
  id: string;
  bookingNumber: string;
  chaletId: string;
  customerId: string | null;
  startAt: Date;
  endAt: Date;
  status: ChaletBookingStatus;
  holdExpiresAt: Date | null;
  totalAmountMinor: bigint;
  version: number;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  chalet?: unknown;
}

const chaletRow = {
  id: CHALET_ID,
  ownerId: OWNER_ID,
  status: 'ACTIVE',
  approvalStatus: 'APPROVED',
  maximumGuests: 20,
  minimumGuests: null,
  holdDurationMinutes: 7,
  defaultCleaningDurationMinutes: 90,
  maximumBookingDurationMinutes: 720,
  currency: 'ILS',
  depositType: 'NONE',
  depositAmountMinor: null,
  depositPercent: null,
  instantBookingEnabled: true,
  cancellationPolicy: null,
};

interface Harness {
  service: ChaletBookingService;
  bookings: BookingRow[];
  events: Array<{ bookingId: string; type: string }>;
  availability: { checkWindow: jest.Mock };
  createSpy: jest.Mock;
}

/**
 * A stand-in for the database that behaves the way the real one does where it
 * matters: writes go through a transaction callback, and a create can be made
 * to fail the way the exclusion constraint fails.
 */
function makeHarness(
  options: {
    bookings?: BookingRow[];
    chalet?: unknown;
    available?: boolean;
    reason?: string;
    createThrows?: unknown;
    offer?: unknown;
  } = {},
): Harness {
  const bookings = options.bookings ?? [];
  const events: Array<{ bookingId: string; type: string }> = [];
  const chalet = options.chalet === undefined ? chaletRow : options.chalet;

  const createSpy = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (options.createThrows !== undefined) throw options.createThrows;
    const row: BookingRow = {
      id: `bk-${bookings.length + 1}`,
      bookingNumber: data.bookingNumber as string,
      chaletId: data.chaletId as string,
      customerId: (data.customerId as string | null) ?? null,
      startAt: data.startAt as Date,
      endAt: data.endAt as Date,
      status: data.status as ChaletBookingStatus,
      holdExpiresAt: (data.holdExpiresAt as Date | undefined) ?? null,
      totalAmountMinor: data.totalAmountMinor as bigint,
      version: 0,
    };
    bookings.push(row);
    return row;
  });

  const tx = {
    chalet: {
      findUnique: jest.fn().mockResolvedValue(chalet),
    },
    chaletOffer: { findUnique: jest.fn().mockResolvedValue(options.offer ?? null) },
    chaletBooking: {
      create: createSpy,
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = bookings.find((b) => b.id === where.id);
        return found === undefined ? null : { ...found, chalet };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = bookings.find((b) => b.id === where.id);
        if (row === undefined) throw new Error('no such booking');
        for (const [key, value] of Object.entries(data)) {
          if (key === 'version') continue;
          Object.assign(row, { [key]: value });
        }
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const expiry = (where.holdExpiresAt as { lte: Date } | undefined)?.lte;
        let count = 0;
        for (const row of bookings) {
          if (where.chaletId !== undefined && row.chaletId !== where.chaletId) continue;
          if (where.status !== undefined && row.status !== where.status) continue;
          if (expiry !== undefined && (row.holdExpiresAt === null || row.holdExpiresAt > expiry)) {
            continue;
          }
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      }),
    },
    chaletBookingEvent: {
      create: jest.fn(async ({ data }: { data: { bookingId: string; type: string } }) => {
        events.push({ bookingId: data.bookingId, type: data.type });
        return data;
      }),
      createMany: jest.fn(),
    },
  };

  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (t: Tx) => Promise<unknown>) => fn(tx as unknown as Tx)),
    nextCounter: jest.fn().mockResolvedValue(7n),
  } as unknown as PrismaService;

  const availability = {
    checkWindow: jest.fn().mockResolvedValue({
      available: options.available ?? true,
      reason: options.reason ?? 'FREE',
      alternatives: [],
    }),
  };

  const pricing = {
    quote: jest.fn().mockResolvedValue({
      baseHourlyRateMinor: 10_000n,
      effectiveHourlyRateMinor: 10_000n,
      durationMinutes: 240,
      subtotalMinor: 40_000n,
      adjustments: [],
      clampedToMinimum: false,
      clampedToMaximum: false,
      currency: 'ILS',
    }),
    depositFor: jest.fn().mockReturnValue(0n),
    toBreakdown: jest.fn().mockReturnValue({ total: { amount: 40_000, currency: 'ILS' } }),
  } as unknown as ChaletPricingService;

  const config = { env: { DEFAULT_TIMEZONE: TZ } } as unknown as AppConfigService;

  return {
    service: new ChaletBookingService(
      prisma,
      config,
      availability as unknown as ChaletAvailabilityService,
      pricing,
    ),
    bookings,
    events,
    availability,
    createSpy,
  };
}

const holdInput = {
  chaletId: CHALET_ID,
  startAt: local('12:00').toISOString(),
  endAt: local('16:00').toISOString(),
  guestCount: 6,
};

describe('formatBookingNumber', () => {
  it('reads as a chalet booking, distinct from a job number', () => {
    expect(formatBookingNumber(7n, new Date('2026-10-01T00:00:00Z'))).toBe('CH-2610-000007');
  });
});

describe('isOverlapRejection', () => {
  it('recognises the exclusion violation by SQLSTATE', () => {
    const error = new Prisma.PrismaClientKnownRequestError('failed', {
      code: 'P2010',
      clientVersion: '5.22.0',
      meta: { code: '23P01' },
    });
    expect(isOverlapRejection(error)).toBe(true);
  });

  it('recognises it by constraint name in the message', () => {
    expect(
      isOverlapRejection(new Error('conflicting key value violates exclusion constraint "chalet_bookings_no_overlap"')),
    ).toBe(true);
  });

  it('does not mistake an ordinary failure for a lost race', () => {
    expect(isOverlapRejection(new Error('connection reset'))).toBe(false);
    expect(
      isOverlapRejection(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      ),
    ).toBe(false);
  });
});

describe('ChaletBookingService.hold', () => {
  it('holds the slot with an expiry set from the chalet', async () => {
    const { service, bookings } = makeHarness();
    const now = local('09:00');
    const booking = await service.hold({ user: user(CUSTOMER_ID) }, holdInput, now);

    expect(booking.status).toBe(ChaletBookingStatus.HELD);
    expect(booking.holdExpiresAt).toEqual(new Date(now.getTime() + 7 * 60_000));
    expect(bookings).toHaveLength(1);
  });

  it('freezes the price onto the booking so the quote cannot drift', async () => {
    const { service, createSpy } = makeHarness();
    await service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));

    const written = createSpy.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(written.pricingSnapshot).toEqual({ total: { amount: 40_000, currency: 'ILS' } });
    expect(written.totalAmountMinor).toBe(40_000n);
    expect(written.cleaningDurationMinutes).toBe(90);
    expect(written.bookingDurationMinutes).toBe(240);
  });

  it('writes an event so the trail starts at the hold', async () => {
    const { service, events } = makeHarness();
    await service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));
    expect(events).toEqual([{ bookingId: 'bk-1', type: 'HELD' }]);
  });

  it('refuses a booking that starts in the past', async () => {
    const { service } = makeHarness();
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('13:00')),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('refuses a chalet that is not taking bookings', async () => {
    const { service } = makeHarness({ chalet: { ...chaletRow, status: 'PAUSED' } });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.FEATURE_DISABLED });
  });

  it('refuses a chalet still awaiting approval', async () => {
    const { service } = makeHarness({ chalet: { ...chaletRow, approvalStatus: 'PENDING' } });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.FEATURE_DISABLED });
  });

  it('refuses more guests than the chalet takes', async () => {
    const { service } = makeHarness();
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, { ...holdInput, guestCount: 40 }, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('explains why an unavailable slot was refused', async () => {
    const { service } = makeHarness({ available: false, reason: 'OVERLAPS_BOOKING' });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00')),
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      details: { reason: 'OVERLAPS_BOOKING' },
    });
  });

  it('turns the database’s refusal into an answer the customer can act on', async () => {
    const { service } = makeHarness({
      createThrows: new Error(
        'conflicting key value violates exclusion constraint "chalet_bookings_no_overlap"',
      ),
    });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('does not disguise an unrelated database failure as a lost race', async () => {
    const { service } = makeHarness({ createThrows: new Error('connection reset by peer') });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00')),
    ).rejects.toThrow('connection reset by peer');
  });

  it('releases lapsed holds before checking availability', async () => {
    const lapsed: BookingRow = {
      id: 'old',
      bookingNumber: 'CH-OLD',
      chaletId: CHALET_ID,
      customerId: OTHER_ID,
      startAt: local('12:00'),
      endAt: local('16:00'),
      status: ChaletBookingStatus.HELD,
      holdExpiresAt: local('08:55'),
      totalAmountMinor: 40_000n,
      version: 0,
    };
    const { service, bookings } = makeHarness({ bookings: [lapsed] });
    await service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));
    expect(bookings[0]?.status).toBe(ChaletBookingStatus.EXPIRED);
  });

  it('leaves a hold that still has time on the clock alone', async () => {
    const live: BookingRow = {
      id: 'live',
      bookingNumber: 'CH-LIVE',
      chaletId: CHALET_ID,
      customerId: OTHER_ID,
      startAt: local('12:00'),
      endAt: local('16:00'),
      status: ChaletBookingStatus.HELD,
      holdExpiresAt: local('09:05'),
      totalAmountMinor: 40_000n,
      version: 0,
    };
    const { service, bookings } = makeHarness({ bookings: [live] });
    await service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));
    expect(bookings[0]?.status).toBe(ChaletBookingStatus.HELD);
  });

  it('refuses an offer that has expired', async () => {
    const { service } = makeHarness({
      offer: {
        id: 'offer-1',
        chaletId: CHALET_ID,
        isActive: true,
        startsAt: local('06:00'),
        expiresAt: local('08:00'),
        slotStartAt: local('12:00'),
        slotEndAt: local('16:00'),
        discountPercent: 20,
      },
    });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, { ...holdInput, offerId: 'offer-1' }, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.OFFER_EXPIRED });
  });

  it('refuses an offer made for a different slot', async () => {
    const { service } = makeHarness({
      offer: {
        id: 'offer-1',
        chaletId: CHALET_ID,
        isActive: true,
        startsAt: local('06:00'),
        expiresAt: local('20:00'),
        slotStartAt: local('18:00'),
        slotEndAt: local('22:00'),
        discountPercent: 20,
      },
    });
    await expect(
      service.hold({ user: user(CUSTOMER_ID) }, { ...holdInput, offerId: 'offer-1' }, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.PROMO_NOT_ELIGIBLE });
  });
});

describe('ChaletBookingService.confirm', () => {
  async function heldBooking(holdExpiresAt: Date) {
    const harness = makeHarness();
    await harness.service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));
    const row = harness.bookings[0];
    if (row === undefined) throw new Error('no booking');
    row.holdExpiresAt = holdExpiresAt;
    return harness;
  }

  it('confirms a hold that is still live', async () => {
    const harness = await heldBooking(local('09:07'));
    const confirmed = await harness.service.confirm(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      local('09:03'),
    );
    expect(confirmed.status).toBe(ChaletBookingStatus.CONFIRMED);
    expect(confirmed.holdExpiresAt).toBeNull();
    expect(harness.events.map((e) => e.type)).toEqual(['HELD', 'CONFIRMED']);
  });

  it('refuses to confirm a hold that has run out, and expires it', async () => {
    const harness = await heldBooking(local('09:07'));
    await expect(
      harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:08')),
    ).rejects.toMatchObject({ code: ErrorCode.OFFER_EXPIRED });
    expect(harness.bookings[0]?.status).toBe(ChaletBookingStatus.EXPIRED);
    expect(harness.events.map((e) => e.type)).toEqual(['HELD', 'EXPIRED']);
  });

  it('confirms exactly on the expiry boundary rather than one moment late', async () => {
    const harness = await heldBooking(local('09:07'));
    await expect(
      harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:07')),
    ).rejects.toMatchObject({ code: ErrorCode.OFFER_EXPIRED });
  });

  it('does not let someone else confirm your hold', async () => {
    const harness = await heldBooking(local('09:07'));
    await expect(
      harness.service.confirm({ user: user(OTHER_ID) }, 'bk-1', local('09:03')),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('refuses to confirm twice', async () => {
    const harness = await heldBooking(local('09:07'));
    await harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:03'));
    await expect(
      harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:04')),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it('reports an unknown booking as not found', async () => {
    const { service } = makeHarness();
    await expect(
      service.confirm({ user: user(CUSTOMER_ID) }, 'nope', local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});

describe('ChaletBookingService.cancel', () => {
  async function confirmedBooking(policy: unknown = null) {
    const harness = makeHarness({ chalet: { ...chaletRow, cancellationPolicy: policy } });
    await harness.service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00', '2026-09-20'));
    await harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:01', '2026-09-20'));
    return harness;
  }

  it('releases the slot and refunds in full when cancelled early', async () => {
    const harness = await confirmedBooking();
    const result = await harness.service.cancel(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { reason: 'تغيّرت خططنا' },
      local('09:00', '2026-09-20'),
    );
    expect(result.booking.status).toBe(ChaletBookingStatus.CANCELLED);
    expect(result.refundPercent).toBe(100);
    expect(result.refundMinor).toBe(40_000n);
  });

  it('refunds partially inside the chalet’s window', async () => {
    const harness = await confirmedBooking();
    const result = await harness.service.cancel(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { reason: 'late' },
      local('09:00'),
    );
    expect(result.refundPercent).toBe(50);
    expect(result.refundMinor).toBe(20_000n);
  });

  it('honours a chalet’s own stricter policy', async () => {
    const harness = await confirmedBooking({
      freeCancellationHours: 168,
      refundPercentAfterWindow: 0,
    });
    const result = await harness.service.cancel(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { reason: 'late' },
      local('09:00', '2026-09-28'),
    );
    expect(result.refundPercent).toBe(0);
  });

  it('refunds the guest in full when the owner is the one cancelling', async () => {
    const harness = await confirmedBooking();
    const result = await harness.service.cancel(
      { user: user(OWNER_ID) },
      'bk-1',
      { reason: 'صيانة طارئة' },
      local('09:00'),
    );
    expect(result.refundPercent).toBe(100);
  });

  it('records the reason and who cancelled', async () => {
    const harness = await confirmedBooking();
    await harness.service.cancel(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { reason: 'تغيّرت خططنا' },
      local('09:00'),
    );
    expect(harness.bookings[0]?.cancellationReason).toBe('تغيّرت خططنا');
    expect(harness.bookings[0]?.cancelledBy).toBe(CUSTOMER_ID);
    expect(harness.events.map((e) => e.type)).toEqual(['HELD', 'CONFIRMED', 'CANCELLED']);
  });

  it('does not let a stranger cancel someone’s booking', async () => {
    const harness = await confirmedBooking();
    await expect(
      harness.service.cancel({ user: user(OTHER_ID) }, 'bk-1', { reason: 'x' }, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('refuses to cancel a booking twice', async () => {
    const harness = await confirmedBooking();
    await harness.service.cancel({ user: user(CUSTOMER_ID) }, 'bk-1', { reason: 'x' }, local('09:00'));
    await expect(
      harness.service.cancel({ user: user(CUSTOMER_ID) }, 'bk-1', { reason: 'x' }, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });
});

describe('ChaletBookingService.extend', () => {
  async function runningBooking() {
    const harness = makeHarness();
    await harness.service.hold({ user: user(CUSTOMER_ID) }, holdInput, local('09:00'));
    await harness.service.confirm({ user: user(CUSTOMER_ID) }, 'bk-1', local('09:01'));
    return harness;
  }

  it('adds the time and charges for it', async () => {
    const harness = await runningBooking();
    const result = await harness.service.extend(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { additionalMinutes: 60 },
      local('15:00'),
    );
    expect(result.booking.endAt).toEqual(local('17:00'));
    expect(result.extraAmountMinor).toBe(40_000n);
  });

  it('does not let the booking collide with itself', async () => {
    const harness = await runningBooking();
    await harness.service.extend(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { additionalMinutes: 60 },
      local('15:00'),
    );
    expect(harness.availability.checkWindow).toHaveBeenLastCalledWith(
      CHALET_ID,
      expect.anything(),
      expect.objectContaining({ excludeBookingId: 'bk-1' }),
    );
  });

  it('refuses when the extra time is already taken', async () => {
    const harness = await runningBooking();
    harness.availability.checkWindow.mockResolvedValue({
      available: false,
      reason: 'OVERLAPS_BOOKING',
      alternatives: [],
    });
    await expect(
      harness.service.extend(
        { user: user(CUSTOMER_ID) },
        'bk-1',
        { additionalMinutes: 60 },
        local('15:00'),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('refuses to push a booking past the chalet’s maximum length', async () => {
    const harness = await runningBooking();
    await expect(
      harness.service.extend(
        { user: user(CUSTOMER_ID) },
        'bk-1',
        { additionalMinutes: 600 },
        local('15:00'),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('refuses to extend a booking that is over', async () => {
    const harness = await runningBooking();
    await harness.service.cancel({ user: user(CUSTOMER_ID) }, 'bk-1', { reason: 'x' }, local('09:02'));
    await expect(
      harness.service.extend(
        { user: user(CUSTOMER_ID) },
        'bk-1',
        { additionalMinutes: 60 },
        local('15:00'),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });

  it('records the extension on the trail', async () => {
    const harness = await runningBooking();
    await harness.service.extend(
      { user: user(CUSTOMER_ID) },
      'bk-1',
      { additionalMinutes: 60 },
      local('15:00'),
    );
    expect(harness.events.map((e) => e.type)).toEqual(['HELD', 'CONFIRMED', 'EXTENDED']);
  });
});

describe('ChaletBookingService.createExternal', () => {
  const external = {
    startAt: local('12:00').toISOString(),
    endAt: local('16:00').toISOString(),
    guestCount: 4,
    guestName: 'أبو محمد',
    source: 'OWNER_MANUAL' as const,
  };

  it('occupies the calendar exactly like a TAMAM booking', async () => {
    const { service, bookings } = makeHarness();
    const booking = await service.createExternal(
      { user: user(OWNER_ID) },
      CHALET_ID,
      external,
      local('09:00'),
    );
    expect(booking.status).toBe(ChaletBookingStatus.CONFIRMED);
    expect(booking.customerId).toBeNull();
    expect(bookings).toHaveLength(1);
  });

  it('is confirmed on arrival because it never goes through payment', async () => {
    const { service } = makeHarness();
    const booking = await service.createExternal(
      { user: user(OWNER_ID) },
      CHALET_ID,
      external,
      local('09:00'),
    );
    expect(booking.holdExpiresAt).toBeNull();
  });

  it('is still refused when it overlaps a customer’s booking', async () => {
    const { service } = makeHarness({
      createThrows: new Error(
        'conflicting key value violates exclusion constraint "chalet_bookings_no_overlap"',
      ),
    });
    await expect(
      service.createExternal({ user: user(OWNER_ID) }, CHALET_ID, external, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('does not let someone who is not the owner record a booking', async () => {
    const { service } = makeHarness();
    await expect(
      service.createExternal({ user: user(OTHER_ID) }, CHALET_ID, external, local('09:00')),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('lets an admin record one on the owner’s behalf', async () => {
    const { service } = makeHarness();
    const booking = await service.createExternal(
      { user: user(OTHER_ID, { isSuperAdmin: true }) },
      CHALET_ID,
      external,
      local('09:00'),
    );
    expect(booking.status).toBe(ChaletBookingStatus.CONFIRMED);
  });

  it('refuses more guests than the chalet takes', async () => {
    const { service } = makeHarness();
    await expect(
      service.createExternal(
        { user: user(OWNER_ID) },
        CHALET_ID,
        { ...external, guestCount: 40 },
        local('09:00'),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
