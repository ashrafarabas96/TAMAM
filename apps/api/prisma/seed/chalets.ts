import type { SeedContext } from './context';
import type { UserSeedResult } from './users';
import type { ZoneSeedResult } from './zones';

/**
 * Two chalets so the module has something to show on a fresh install: one live
 * and bookable, one waiting for approval so the console's review queue is not
 * empty on first sign-in.
 *
 * Fixed ids, so re-seeding updates these rows rather than adding more.
 */
const LIVE_ID = '0d1e2f3a-4b5c-4d6e-8f90-a1b2c3d4e5f6';
const PENDING_ID = '1e2f3a4b-5c6d-4e7f-9a01-b2c3d4e5f6a7';

const AMENITIES = [
  ['pool', 'مسبح', 'Pool'],
  ['bbq', 'شواء', 'Barbecue'],
  ['wifi', 'واي فاي', 'Wi-Fi'],
  ['parking', 'موقف سيارات', 'Parking'],
  ['playground', 'ألعاب أطفال', 'Playground'],
] as const;

export async function seedChalets(
  ctx: SeedContext,
  zones: ZoneSeedResult,
  users: UserSeedResult,
): Promise<void> {
  const { prisma } = ctx;
  const zoneId = zones.zoneIds.get('NABLUS') ?? [...zones.zoneIds.values()][0];
  if (zoneId === undefined) throw new Error('chalet seed needs a service zone');

  // The demo partner owns them: a chalet owner is a provider, and this keeps
  // the owner dashboard reachable with an account the seed already documents.
  const ownerId = users.partnerIds.values().next().value ?? users.customerId;
  if (ownerId === undefined) throw new Error('chalet seed needs an owner');

  const shared = {
    ownerId,
    serviceZoneId: zoneId,
    city: 'Nablus',
    openingTime: '08:00',
    closingTime: '23:00',
    minimumBookingDurationMinutes: 120,
    maximumBookingDurationMinutes: 720,
    bookingIntervalMinutes: 15,
    defaultCleaningDurationMinutes: 90,
    currency: ctx.currency,
    cancellationPolicy: { freeCancellationHours: 48, refundPercentAfterWindow: 50 },
  };

  const live = await prisma.chalet.upsert({
    where: { id: LIVE_ID },
    update: {},
    create: {
      ...shared,
      id: LIVE_ID,
      nameAr: 'شاليه الريحان',
      nameEn: 'Al Rayhan Chalet',
      descriptionAr: 'شاليه عائلي مع مسبح خاص وإطلالة على الجبل، مناسب للمناسبات والعطلات.',
      descriptionEn: 'A family chalet with a private pool and a mountain view.',
      addressLine: 'طريق نابلس — رام الله',
      lat: 32.221,
      lng: 35.254,
      maximumGuests: 20,
      minimumGuests: 2,
      baseHourlyRateMinor: 12_000n,
      minimumHourlyRateMinor: 8_000n,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      smartPricingEnabled: true,
      gapFillerEnabled: true,
      targetOccupancyPercent: 70,
    },
  });

  await prisma.chalet.upsert({
    where: { id: PENDING_ID },
    update: {},
    create: {
      ...shared,
      id: PENDING_ID,
      nameAr: 'شاليه الزيتون',
      nameEn: 'Al Zaytoun Chalet',
      descriptionAr: 'شاليه هادئ بين أشجار الزيتون.',
      descriptionEn: 'A quiet chalet among the olive trees.',
      addressLine: 'بلعا — طولكرم',
      lat: 32.318,
      lng: 35.116,
      maximumGuests: 12,
      baseHourlyRateMinor: 9_000n,
      minimumHourlyRateMinor: 6_000n,
      // Left waiting on purpose, so the console's review queue has work in it.
      status: 'PENDING_APPROVAL',
      approvalStatus: 'PENDING',
    },
  });

  for (const [code, nameAr, nameEn] of AMENITIES) {
    await prisma.chaletAmenity.upsert({
      where: { chaletId_code: { chaletId: live.id, code } },
      update: { nameAr, nameEn },
      create: { chaletId: live.id, code, nameAr, nameEn },
    });
  }

  ctx.summary.set('chalets', 2);
  ctx.summary.note(
    'chalets: شاليه الريحان is live and bookable; شاليه الزيتون is waiting for approval',
  );
}
