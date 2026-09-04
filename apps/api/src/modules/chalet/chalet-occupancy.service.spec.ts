import { AccountStatus, ChaletBookingStatus, ErrorCode, UserRole } from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

import type { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletOccupancyService } from './chalet-occupancy.service';

const CHALET_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const TZ = 'Asia/Jerusalem';

const local = (hhmm: string, date: string): Date => new Date(`${date}T${hhmm}:00+03:00`);

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

interface BookingRow {
  startAt: Date;
  endAt: Date;
  bookingDurationMinutes: number;
  totalAmountMinor: bigint;
  status: ChaletBookingStatus;
  currency: string;
}

const booking = (
  date: string,
  from: string,
  minutes: number,
  status: ChaletBookingStatus = ChaletBookingStatus.COMPLETED,
): BookingRow => ({
  startAt: local(from, date),
  endAt: new Date(local(from, date).getTime() + minutes * 60_000),
  bookingDurationMinutes: minutes,
  totalAmountMinor: BigInt(minutes * 100),
  status,
  currency: 'ILS',
});

function makeService(bookings: BookingRow[], owner: unknown = { ownerId: OWNER_ID }) {
  const prisma = {
    chalet: { findUnique: jest.fn().mockResolvedValue(owner) },
    chaletBooking: { findMany: jest.fn().mockResolvedValue(bookings) },
  } as unknown as PrismaService;

  const availability = {
    loadSchedule: jest.fn().mockResolvedValue(schedule),
  } as unknown as ChaletAvailabilityService;

  const config = { env: { DEFAULT_TIMEZONE: TZ } } as unknown as AppConfigService;
  return new ChaletOccupancyService(prisma, config, availability);
}

const user = (id: string, isSuperAdmin = false): RequestUser => ({
  id,
  phone: '+970599000001',
  roles: [UserRole.CUSTOMER],
  permissions: [],
  accountStatus: AccountStatus.ACTIVE,
  sessionId: 's',
  deviceId: 'd',
  language: 'ar',
  customerId: id,
  isSuperAdmin,
});

describe('ChaletOccupancyService.assertOwner', () => {
  it('lets the owner through', async () => {
    await expect(makeService([]).assertOwner(user(OWNER_ID), CHALET_ID)).resolves.toBeUndefined();
  });

  it('keeps everyone else out', async () => {
    await expect(makeService([]).assertOwner(user(OTHER_ID), CHALET_ID)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('lets an admin through', async () => {
    await expect(
      makeService([]).assertOwner(user(OTHER_ID, true), CHALET_ID),
    ).resolves.toBeUndefined();
  });

  it('reports an unknown chalet as not found', async () => {
    await expect(makeService([], null).assertOwner(user(OWNER_ID), CHALET_ID)).rejects.toMatchObject(
      { code: ErrorCode.NOT_FOUND },
    );
  });
});

describe('ChaletOccupancyService.report', () => {
  it('reports an empty month as zero without dividing by nothing', async () => {
    const report = await makeService([]).report(CHALET_ID, '2026-10-30');
    expect(report.occupancyPercent).toBe(0);
    expect(report.bookingCount).toBe(0);
    expect(report.averageBookingDurationMinutes).toBe(0);
    expect(report.averageHourlyRate.amount).toBe(0);
    expect(report.bookableMinutes).toBe(30 * 15 * 60);
  });

  it('measures booked minutes against the chalet’s opening hours', async () => {
    // One four-hour booking in a thirty-day window of fifteen-hour days.
    const report = await makeService([booking('2026-10-15', '12:00', 240)]).report(
      CHALET_ID,
      '2026-10-30',
    );
    expect(report.bookedMinutes).toBe(240);
    expect(report.bookableMinutes).toBe(27_000);
    expect(report.occupancyPercent).toBe(1);
  });

  it('counts cancellations separately rather than hiding them', async () => {
    const report = await makeService([
      booking('2026-10-15', '12:00', 240),
      booking('2026-10-16', '12:00', 240, ChaletBookingStatus.CANCELLED),
      booking('2026-10-17', '12:00', 240, ChaletBookingStatus.NO_SHOW),
    ]).report(CHALET_ID, '2026-10-30');

    expect(report.bookingCount).toBe(1);
    expect(report.cancelledCount).toBe(2);
    // A cancelled booking earns nothing and occupies nothing.
    expect(report.bookedMinutes).toBe(240);
  });

  it('averages the hourly rate over the minutes actually booked', async () => {
    // 240 minutes at 100 minor units a minute = 24000, which is 6000 an hour.
    const report = await makeService([booking('2026-10-15', '12:00', 240)]).report(
      CHALET_ID,
      '2026-10-30',
    );
    expect(report.revenue.amount).toBe(24_000);
    expect(report.averageHourlyRate.amount).toBe(6_000);
  });

  it('shows which weekday sits empty', async () => {
    // 2026-10-15 is a Thursday.
    const report = await makeService([booking('2026-10-15', '12:00', 240)]).report(
      CHALET_ID,
      '2026-10-30',
    );
    expect(report.byDayOfWeek).toHaveLength(7);
    expect(report.byDayOfWeek[4]?.bookedMinutes).toBe(240);
    expect(report.byDayOfWeek[0]?.bookedMinutes).toBe(0);
  });

  it('spreads a long booking across the hours it covers', async () => {
    const report = await makeService([booking('2026-10-15', '12:00', 240)]).report(
      CHALET_ID,
      '2026-10-30',
    );
    expect(report.byHourOfDay).toHaveLength(24);
    const busy = report.byHourOfDay.filter((h) => h.bookedMinutes > 0);
    // Four hours booked shows in four bars, not one.
    expect(busy).toHaveLength(4);
    expect(busy.every((h) => h.bookedMinutes === 60)).toBe(true);
  });

  it('reports the window it actually covered', async () => {
    const report = await makeService([]).report(CHALET_ID, '2026-10-30');
    expect(report.toDate).toBe('2026-10-30');
    expect(report.fromDate).toBe('2026-10-01');
  });
});
