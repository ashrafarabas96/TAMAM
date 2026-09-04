import { ChaletBookingStatus } from '@tamam/shared-types';

import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

import type { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletOffersService } from './chalet-offers.service';
import type { Occupancy } from './domain/availability';

const CHALET_ID = '11111111-1111-4111-8111-111111111111';
const TZ = 'Asia/Jerusalem';

const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

const chaletRow = {
  id: CHALET_ID,
  status: 'ACTIVE',
  gapFillerEnabled: true,
  lastMinutePricingEnabled: false,
  openingTime: '08:00',
  closingTime: '23:00',
  minimumBookingDurationMinutes: 120,
  defaultCleaningDurationMinutes: 90,
  baseHourlyRateMinor: 10_000n,
  minimumHourlyRateMinor: 6_000n,
  maxAutoDiscountPercent: null,
  currency: 'ILS',
};

interface Fixture {
  chalet?: unknown;
  occupancies?: Occupancy[];
  existingOffer?: unknown;
  liveOffers?: unknown[];
  conflictCount?: number;
}

function makeService(fixture: Fixture = {}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];

  const prisma = {
    chalet: {
      findUnique: jest
        .fn()
        .mockResolvedValue(fixture.chalet === undefined ? chaletRow : fixture.chalet),
      findMany: jest.fn().mockResolvedValue([{ id: CHALET_ID }]),
    },
    chaletOffer: {
      findFirst: jest.fn().mockResolvedValue(fixture.existingOffer ?? null),
      findMany: jest.fn().mockResolvedValue(fixture.liveOffers ?? []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `offer-${created.length}`, ...data };
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updated.push(data);
        return data;
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    chaletBooking: { count: jest.fn().mockResolvedValue(fixture.conflictCount ?? 0) },
  } as unknown as PrismaService;

  const availability = {
    occupanciesBetween: jest.fn().mockResolvedValue(fixture.occupancies ?? []),
    gapsForDate: jest.fn().mockResolvedValue([]),
  } as unknown as ChaletAvailabilityService;

  const config = { env: { DEFAULT_TIMEZONE: TZ } } as unknown as AppConfigService;

  return {
    service: new ChaletOffersService(prisma, config, availability),
    created,
    updated,
    prisma,
  };
}

const booked = (from: string, to: string): Occupancy => ({
  kind: 'BOOKING',
  startAt: local(from),
  endAt: local(to),
});

describe('ChaletOffersService.generateForChalet', () => {
  it('offers the gap boxed in between two bookings', async () => {
    const { service, created } = makeService({
      // Booked 08:00-12:00 and 15:00-23:00: a three-hour hole in the middle.
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    const count = await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'));

    expect(count).toBe(1);
    expect(created[0]?.kind).toBe('GAP_FILLER');
    expect(created[0]?.slotStartAt).toEqual(local('12:00'));
    expect(created[0]?.slotEndAt).toEqual(local('15:00'));
  });

  it('does not offer the open end of the day when only the gap filler is on', async () => {
    const { service, created } = makeService({ occupancies: [booked('08:00', '12:00')] });
    await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'));
    expect(created).toEqual([]);
  });

  it('does nothing when the owner turned both switches off', async () => {
    const { service, created } = makeService({
      chalet: { ...chaletRow, gapFillerEnabled: false, lastMinutePricingEnabled: false },
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    expect(await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'))).toBe(0);
    expect(created).toEqual([]);
  });

  it('does nothing for a chalet that is not active', async () => {
    const { service } = makeService({ chalet: { ...chaletRow, status: 'PAUSED' } });
    expect(await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'))).toBe(0);
  });

  it('does not stack a second offer on a slot that already has one', async () => {
    const { service, created } = makeService({
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
      existingOffer: { id: 'already-there' },
    });
    expect(await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'))).toBe(0);
    expect(created).toEqual([]);
  });

  it('never advertises below the owner’s floor', async () => {
    const { service, created } = makeService({
      chalet: { ...chaletRow, minimumHourlyRateMinor: 9_000n },
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'));
    expect(created[0]?.hourlyRateMinor).toBe(9_000n);
    // The advertised discount is restated to match what is actually offered.
    expect(created[0]?.discountPercent).toBe(10);
  });

  it('advertises nothing when the floor swallows the whole discount', async () => {
    const { service, created } = makeService({
      chalet: { ...chaletRow, minimumHourlyRateMinor: 10_000n },
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    expect(await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'))).toBe(0);
    expect(created).toEqual([]);
  });

  it('honours the owner’s own cap on how deep an offer may go', async () => {
    const { service, created } = makeService({
      chalet: { ...chaletRow, maxAutoDiscountPercent: 5 },
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'));
    expect(created[0]?.discountPercent as number).toBeLessThanOrEqual(5);
  });

  it('offers a last-minute window when that switch is on', async () => {
    const { service, created } = makeService({
      chalet: { ...chaletRow, gapFillerEnabled: false, lastMinutePricingEnabled: true },
      occupancies: [booked('08:00', '14:00')],
    });
    await service.generateForChalet(CHALET_ID, '2026-10-01', local('13:00'));
    expect(created[0]?.kind).toBe('LAST_MINUTE');
  });

  it('writes both languages onto the offer', async () => {
    const { service, created } = makeService({
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    await service.generateForChalet(CHALET_ID, '2026-10-01', local('06:00'));
    expect(created[0]?.titleAr).toBe('فرصة بين حجزين — سعر مخفّض');
    expect(created[0]?.titleEn).toBe('Between two bookings — reduced rate');
  });
});

describe('ChaletOffersService.retireStaleOffers', () => {
  it('retires an offer whose slot has since been booked', async () => {
    const { service, updated } = makeService({
      liveOffers: [
        {
          id: 'offer-1',
          chaletId: CHALET_ID,
          slotStartAt: local('12:00'),
          slotEndAt: local('15:00'),
        },
      ],
      conflictCount: 1,
    });
    const retired = await service.retireStaleOffers(local('10:00'));
    expect(retired).toBe(1);
    expect(updated[0]).toMatchObject({ isActive: false, deactivationReason: 'slot taken' });
  });

  it('leaves an offer whose slot is still free', async () => {
    const { service, updated } = makeService({
      liveOffers: [
        {
          id: 'offer-1',
          chaletId: CHALET_ID,
          slotStartAt: local('12:00'),
          slotEndAt: local('15:00'),
        },
      ],
      conflictCount: 0,
    });
    expect(await service.retireStaleOffers(local('10:00'))).toBe(0);
    expect(updated).toEqual([]);
  });

  it('does not count a cancelled booking as having taken the slot', async () => {
    const { service, prisma } = makeService({
      liveOffers: [
        {
          id: 'offer-1',
          chaletId: CHALET_ID,
          slotStartAt: local('12:00'),
          slotEndAt: local('15:00'),
        },
      ],
    });
    await service.retireStaleOffers(local('10:00'));

    const where = (prisma.chaletBooking.count as jest.Mock).mock.calls[0]?.[0].where as {
      status: { notIn: ChaletBookingStatus[] };
    };
    expect(where.status.notIn).toContain(ChaletBookingStatus.CANCELLED);
    expect(where.status.notIn).toContain(ChaletBookingStatus.EXPIRED);
  });
});

describe('ChaletOffersService.generateForAll', () => {
  it('covers today and tomorrow for every chalet that wants offers', async () => {
    const { service, prisma } = makeService({
      occupancies: [booked('08:00', '12:00'), booked('15:00', '23:00')],
    });
    await service.generateForAll(local('06:00'));
    // One findUnique per chalet per day.
    expect((prisma.chalet.findUnique as jest.Mock).mock.calls).toHaveLength(2);
  });
});
