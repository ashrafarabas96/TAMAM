import { ChaletBookingStatus, ErrorCode } from '@tamam/shared-types';

import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { ChaletAvailabilityService } from './chalet-availability.service';

const CHALET_ID = '11111111-1111-4111-8111-111111111111';

/** "2026-10-01 12:00" in Asia/Jerusalem (UTC+3 in October), as an absolute instant. */
const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

interface BookingRow {
  id: string;
  startAt: Date;
  blockedUntil: Date;
  status: ChaletBookingStatus;
  holdExpiresAt: Date | null;
}

interface BlockRow {
  startAt: Date;
  endAt: Date;
}

const schedule = {
  id: CHALET_ID,
  openingTime: '08:00',
  closingTime: '23:00',
  bookingIntervalMinutes: 15,
  minimumBookingDurationMinutes: 120,
  maximumBookingDurationMinutes: 720,
  defaultCleaningDurationMinutes: 90,
  holdDurationMinutes: 7,
  maximumGuests: 20,
  minimumGuests: null,
  status: 'ACTIVE',
};

/**
 * A stand-in for the two tables the engine reads. It applies the same filters
 * the real query does — the time window, the slot-holding statuses and the hold
 * expiry — so a test can tell whether the service asked for the right rows.
 */
function makePrisma(bookings: BookingRow[], blocks: BlockRow[] = [], chalet: unknown = schedule) {
  return {
    chalet: {
      findUnique: jest.fn().mockResolvedValue(chalet),
    },
    chaletBooking: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const startLt = (where.startAt as { lt: Date }).lt;
        const blockedGt = (where.blockedUntil as { gt: Date }).gt;
        const clauses = where.OR as Array<{
          status: ChaletBookingStatus | { in: ChaletBookingStatus[] };
          holdExpiresAt?: { gt: Date };
        }>;
        const excluded = (where.id as { not: string } | undefined)?.not;

        return bookings.filter((b) => {
          if (b.id === excluded) return false;
          if (!(b.startAt < startLt && b.blockedUntil > blockedGt)) return false;
          return clauses.some((clause) => {
            if (typeof clause.status === 'object') {
              return clause.status.in.includes(b.status);
            }
            if (clause.status !== b.status) return false;
            const after = clause.holdExpiresAt?.gt;
            return after === undefined || (b.holdExpiresAt !== null && b.holdExpiresAt > after);
          });
        });
      }),
    },
    chaletBlock: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const startLt = (where.startAt as { lt: Date }).lt;
        const endGt = (where.endAt as { gt: Date }).gt;
        return blocks.filter((b) => b.startAt < startLt && b.endAt > endGt);
      }),
    },
  };
}

const config = { env: { DEFAULT_TIMEZONE: 'Asia/Jerusalem' } } as unknown as AppConfigService;

function makeService(prisma: ReturnType<typeof makePrisma>): ChaletAvailabilityService {
  return new ChaletAvailabilityService(prisma as unknown as PrismaService, config);
}

const confirmed = (id: string, from: string, blockedUntil: string): BookingRow => ({
  id,
  startAt: local(from),
  blockedUntil: local(blockedUntil),
  status: ChaletBookingStatus.CONFIRMED,
  holdExpiresAt: null,
});

const held = (id: string, from: string, blockedUntil: string, expiresAt: Date): BookingRow => ({
  id,
  startAt: local(from),
  blockedUntil: local(blockedUntil),
  status: ChaletBookingStatus.HELD,
  holdExpiresAt: expiresAt,
});

describe('ChaletAvailabilityService.forDate', () => {
  it('offers the whole day when nothing is booked', async () => {
    const service = makeService(makePrisma([]));
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now: local('06:00') });

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.availableMinutes).toBe(15 * 60);
    expect(result.bookingIntervalMinutes).toBe(15);
    expect(result.cleaningDurationMinutes).toBe(90);
    expect(result.suggestedStartTimes[0]).toBe(local('08:00').toISOString());
  });

  it('subtracts the cleaning buffer, not just the booking', async () => {
    // Booked 12:00-16:00; the database says the slot is held until 17:30.
    const service = makeService(makePrisma([confirmed('b1', '12:00', '17:30')]));
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now: local('06:00') });

    expect(result.windows.map((w) => w.startAt)).toEqual([
      local('08:00').toISOString(),
      local('17:30').toISOString(),
    ]);
    expect(result.suggestedStartTimes).not.toContain(local('16:00').toISOString());
    expect(result.suggestedStartTimes).toContain(local('17:30').toISOString());
  });

  it('treats an owner block like a booking', async () => {
    const service = makeService(
      makePrisma([], [{ startAt: local('12:00'), endAt: local('16:00') }]),
    );
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now: local('06:00') });
    expect(result.windows).toHaveLength(2);
    expect(result.windows[1]?.startAt).toBe(local('16:00').toISOString());
  });

  it('keeps a live hold blocking the calendar', async () => {
    const now = local('11:00');
    const service = makeService(
      makePrisma([held('h1', '12:00', '17:30', local('11:05'))]),
    );
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now });
    expect(result.windows).toHaveLength(2);
  });

  it('frees the slot the moment a hold lapses, without waiting for the sweeper', async () => {
    const now = local('11:10');
    const service = makeService(
      makePrisma([held('h1', '12:00', '17:30', local('11:05'))]),
    );
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now });
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.availableMinutes).toBe(15 * 60);
  });

  it('hides windows that have already ended today', async () => {
    const service = makeService(makePrisma([]));
    const result = await service.forDate(CHALET_ID, '2026-10-01', { now: local('19:00') });
    expect(result.suggestedStartTimes[0]).toBe(local('19:00').toISOString());
  });

  it('offers a future day in full even when today is half gone', async () => {
    const service = makeService(makePrisma([]));
    const result = await service.forDate(CHALET_ID, '2026-10-02', { now: local('19:00') });
    expect(result.suggestedStartTimes[0]).toBe(local('08:00', '2026-10-02').toISOString());
  });

  it('asks for a window wide enough to see a late booking’s cleaning', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);
    await service.forDate(CHALET_ID, '2026-10-01', { now: local('06:00') });

    const where = prisma.chaletBooking.findMany.mock.calls[0]?.[0].where as {
      startAt: { lt: Date };
      blockedUntil: { gt: Date };
    };
    // 90 minutes before opening and 90 after closing, so a buffer that spills
    // over either edge is still read.
    expect(where.blockedUntil.gt).toEqual(local('06:30'));
    expect(where.startAt.lt).toEqual(local('00:30', '2026-10-02'));
  });

  it('reports an unknown chalet as not found', async () => {
    const service = makeService(makePrisma([], [], null));
    await expect(service.forDate(CHALET_ID, '2026-10-01')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});

describe('ChaletAvailabilityService.checkWindow', () => {
  const occupied = [confirmed('b1', '12:00', '17:30')];

  it('accepts a free window', async () => {
    const service = makeService(makePrisma([]));
    const result = await service.checkWindow(CHALET_ID, {
      startAt: local('12:00'),
      endAt: local('16:00'),
    });
    expect(result).toMatchObject({ available: true, reason: 'FREE', alternatives: [] });
  });

  it('refuses a start inside the previous booking’s cleaning window', async () => {
    const service = makeService(makePrisma(occupied));
    const result = await service.checkWindow(
      CHALET_ID,
      { startAt: local('16:00'), endAt: local('18:00') },
      { now: local('09:00') },
    );
    expect(result.available).toBe(false);
    expect(result.reason).toBe('OVERLAPS_BOOKING');
  });

  it('offers alternatives when the requested window is taken', async () => {
    const service = makeService(makePrisma(occupied));
    const result = await service.checkWindow(
      CHALET_ID,
      { startAt: local('16:00'), endAt: local('18:00') },
      { now: local('09:00') },
    );
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(5);
    for (const alternative of result.alternatives) {
      expect(alternative.availableMinutes).toBe(120);
    }
  });

  it('does not let a booking block itself when it is being extended', async () => {
    const service = makeService(makePrisma(occupied));
    const asIs = await service.checkWindow(
      CHALET_ID,
      { startAt: local('12:00'), endAt: local('18:00') },
      { now: local('09:00') },
    );
    expect(asIs.available).toBe(false);

    const extending = await service.checkWindow(
      CHALET_ID,
      { startAt: local('12:00'), endAt: local('18:00') },
      { excludeBookingId: 'b1', now: local('09:00') },
    );
    expect(extending.available).toBe(true);
  });

  it('names the block when a block is what is in the way', async () => {
    const service = makeService(
      makePrisma([], [{ startAt: local('12:00'), endAt: local('16:00') }]),
    );
    const result = await service.checkWindow(
      CHALET_ID,
      { startAt: local('13:00'), endAt: local('15:00') },
      { now: local('09:00') },
    );
    expect(result.reason).toBe('OVERLAPS_BLOCK');
  });
});

describe('ChaletAvailabilityService.gapsForDate', () => {
  it('finds the empty stretch boxed in between two bookings', async () => {
    const service = makeService(
      makePrisma([confirmed('b1', '08:00', '12:00'), confirmed('b2', '15:00', '23:00')]),
    );
    const gaps = await service.gapsForDate(CHALET_ID, '2026-10-01', { now: local('06:00') });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.availableMinutes).toBe(180);
  });

  it('does not call the open end of the day a gap', async () => {
    const service = makeService(makePrisma([confirmed('b1', '08:00', '12:00')]));
    const gaps = await service.gapsForDate(CHALET_ID, '2026-10-01', { now: local('06:00') });
    expect(gaps).toEqual([]);
  });

  it('ignores gaps too short to be worth an offer', async () => {
    const service = makeService(
      makePrisma([confirmed('b1', '08:00', '12:00'), confirmed('b2', '12:30', '23:00')]),
    );
    const gaps = await service.gapsForDate(CHALET_ID, '2026-10-01', {
      minimumMinutes: 60,
      now: local('06:00'),
    });
    expect(gaps).toEqual([]);
  });
});
