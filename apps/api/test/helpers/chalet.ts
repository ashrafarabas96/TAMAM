import { randomInt, randomUUID } from 'node:crypto';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

/**
 * A distinct Palestinian mobile number per call. Timestamps are not enough:
 * two customers created in the same millisecond — which is exactly what the
 * race test does — would collide on the phone unique index.
 */
const uniquePhone = (): string => `+9705${String(randomInt(10_000_000, 99_999_999))}`;

export interface ChaletFixture {
  chaletId: string;
  ownerId: string;
}

/**
 * A chalet ready to be booked: active, approved, open 08:00–23:00, cleaned for
 * ninety minutes after every booking, on a fifteen-minute grid.
 *
 * The owner is a real user row so ownership checks exercise the same path they
 * would in production.
 */
export async function createChaletFixture(
  prisma: PrismaService,
  overrides: Record<string, unknown> = {},
): Promise<ChaletFixture> {
  const zone = await prisma.serviceZone.findFirst({ select: { id: true } });
  if (zone === null) throw new Error('the seed produced no service zone');

  const owner = await prisma.user.create({
    data: {
      phone: uniquePhone(),
      fullName: 'مالك شاليه',
      accountStatus: 'ACTIVE',
      phoneVerifiedAt: new Date(),
      roles: { create: { role: 'CUSTOMER' } },
    },
    select: { id: true },
  });

  const chalet = await prisma.chalet.create({
    data: {
      ownerId: owner.id,
      nameAr: 'شاليه الاختبار',
      nameEn: 'Test Chalet',
      addressLine: 'طريق نابلس ١',
      city: 'Nablus',
      lat: 32.221,
      lng: 35.254,
      serviceZoneId: zone.id,
      maximumGuests: 20,
      openingTime: '08:00',
      closingTime: '23:00',
      minimumBookingDurationMinutes: 120,
      maximumBookingDurationMinutes: 720,
      bookingIntervalMinutes: 15,
      defaultCleaningDurationMinutes: 90,
      baseHourlyRateMinor: 10_000n,
      minimumHourlyRateMinor: 6_000n,
      currency: 'ILS',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      ...overrides,
    },
    select: { id: true },
  });

  return { chaletId: chalet.id, ownerId: owner.id };
}

/** A customer who can hold a booking, without going through the OTP flow. */
export async function createChaletCustomer(prisma: PrismaService): Promise<string> {
  const user = await prisma.user.create({
    data: {
      phone: uniquePhone(),
      fullName: `ضيف ${randomUUID().slice(0, 6)}`,
      accountStatus: 'ACTIVE',
      phoneVerifiedAt: new Date(),
      roles: { create: { role: 'CUSTOMER' } },
    },
    select: { id: true },
  });
  return user.id;
}
