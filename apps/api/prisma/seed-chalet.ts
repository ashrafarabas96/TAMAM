/**
 * Seeds one demo chalet so the prototype and a running app have something to
 * show. Idempotent: re-running it updates the same row.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const zone = await prisma.serviceZone.findFirst({ select: { id: true } });
  const owner = await prisma.user.findFirst({ select: { id: true } });
  if (zone === null || owner === null) throw new Error('seed the platform first');

  const chalet = await prisma.chalet.upsert({
    where: { id: '0d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6' },
    update: {},
    create: {
      id: '0d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6',
      ownerId: owner.id,
      nameAr: 'شاليه الريحان',
      nameEn: 'Al Rayhan Chalet',
      descriptionAr: 'شاليه عائلي مع مسبح خاص وإطلالة على الجبل.',
      descriptionEn: 'A family chalet with a private pool and a mountain view.',
      addressLine: 'طريق نابلس — رام الله',
      city: 'Nablus',
      lat: 32.221,
      lng: 35.254,
      serviceZoneId: zone.id,
      maximumGuests: 20,
      minimumGuests: 2,
      openingTime: '08:00',
      closingTime: '23:00',
      minimumBookingDurationMinutes: 120,
      maximumBookingDurationMinutes: 720,
      bookingIntervalMinutes: 15,
      defaultCleaningDurationMinutes: 90,
      baseHourlyRateMinor: 12_000n,
      minimumHourlyRateMinor: 8_000n,
      currency: 'ILS',
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      smartPricingEnabled: true,
      gapFillerEnabled: true,
      targetOccupancyPercent: 70,
      cancellationPolicy: { freeCancellationHours: 48, refundPercentAfterWindow: 50 },
    },
  });

  for (const [code, nameAr, nameEn] of [
    ['pool', 'مسبح', 'Pool'],
    ['bbq', 'شواء', 'Barbecue'],
    ['wifi', 'واي فاي', 'Wi-Fi'],
    ['parking', 'موقف سيارات', 'Parking'],
  ] as const) {
    await prisma.chaletAmenity.upsert({
      where: { chaletId_code: { chaletId: chalet.id, code } },
      update: { nameAr, nameEn },
      create: { chaletId: chalet.id, code, nameAr, nameEn },
    });
  }

  console.warn(`seeded chalet ${chalet.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
