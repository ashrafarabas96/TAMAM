import { Prisma } from '@prisma/client';
import { CommissionScope, JobType, PromoType } from '@tamam/shared-types';
import type { DeliveryPricingRule, HomeServicePricingRule, RidePricingRule } from '@tamam/validation';

import { type SeedContext, shekels } from './context';
import type { CatalogSeedResult } from './catalog';

/**
 * Launch pricing for Palestine, ILS. Every amount below is in **agorot** (1 ILS = 100), exactly
 * as it is stored in `pricing_rules.rule` and read back by `PricingService.parseRule`.
 */

/** ECONOMY baseline: 5 ILS flag-fall + 2.50 ILS/km + 0.30 ILS/min, 10 ILS minimum, 1 ILS booking. */
const RIDE_ECONOMY: RidePricingRule = {
  baseFare: 500,
  perKm: 250,
  perMinute: 30,
  minimumFare: 1000,
  bookingFee: 100,
  zoneFee: 0,
  serviceFeePercent: 0,
  taxPercent: 0,
  waitingPerMinute: 50,
  freeWaitingMinutes: 3,
  surgeMultiplier: 1,
};

/** Scales every money field of a ride rule; percentages and minute allowances stay as they are. */
function scaleRide(rule: RidePricingRule, factor: number): RidePricingRule {
  const scale = (v: number): number => Math.round(v * factor);
  return {
    ...rule,
    baseFare: scale(rule.baseFare),
    perKm: scale(rule.perKm),
    perMinute: scale(rule.perMinute),
    minimumFare: scale(rule.minimumFare),
    bookingFee: scale(rule.bookingFee),
    zoneFee: scale(rule.zoneFee),
    waitingPerMinute: scale(rule.waitingPerMinute),
  };
}

const RIDE_FAMILY = scaleRide(RIDE_ECONOMY, 1.25);
const RIDE_PREMIUM = scaleRide(RIDE_ECONOMY, 1.6);

const DELIVERY_RULE: DeliveryPricingRule = {
  base: 800,
  perKm: 200,
  perKgOverThreshold: 0,
  weightThresholdKg: 5,
  sizeMultipliers: { SMALL: 1, MEDIUM: 1.2, LARGE: 1.5, XL: 2 },
  urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 },
  perAdditionalStop: 0,
  minimumFare: 1000,
  bookingFee: 0,
  taxPercent: 0,
};

const HOME_SERVICE_RULE: HomeServicePricingRule = {
  inspectionFee: 3000, // 30 ILS, refunded into the job total when the quote is approved
  inspectionFeeWaivedOnApproval: true,
  urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 },
  bookingFee: 0,
  taxPercent: 0,
};

interface RuleSeed {
  jobType: JobType;
  name: string;
  vehicleTypeCode: string | null;
  priority: number;
  rule: RidePricingRule | DeliveryPricingRule | HomeServicePricingRule;
}

const RULES: RuleSeed[] = [
  { jobType: JobType.RIDE, name: 'Ride — standard (all zones)', vehicleTypeCode: null, priority: 0, rule: RIDE_ECONOMY },
  { jobType: JobType.RIDE, name: 'Ride — family (×1.25)', vehicleTypeCode: 'FAMILY', priority: 10, rule: RIDE_FAMILY },
  { jobType: JobType.RIDE, name: 'Ride — premium (×1.6)', vehicleTypeCode: 'PREMIUM', priority: 10, rule: RIDE_PREMIUM },
  { jobType: JobType.DELIVERY, name: 'Delivery — standard (all zones)', vehicleTypeCode: null, priority: 0, rule: DELIVERY_RULE },
  { jobType: JobType.HOME_SERVICE, name: 'Home service — inspection & quote', vehicleTypeCode: null, priority: 0, rule: HOME_SERVICE_RULE },
];

export async function seedPricing(ctx: SeedContext, catalog: CatalogSeedResult): Promise<void> {
  const { prisma, summary, currency } = ctx;
  const now = new Date();

  for (const seed of RULES) {
    const vehicleTypeId = seed.vehicleTypeCode ? (catalog.vehicleTypeIds.get(seed.vehicleTypeCode) ?? null) : null;
    if (seed.vehicleTypeCode && !vehicleTypeId) throw new Error(`vehicle type ${seed.vehicleTypeCode} is missing — seed the catalogue first`);
    const data = {
      jobType: seed.jobType,
      zoneId: null,
      vehicleTypeId,
      categoryId: null,
      currency,
      name: seed.name,
      priority: seed.priority,
      rule: seed.rule as unknown as Prisma.InputJsonValue,
      validFrom: now,
      validTo: null,
      isActive: true,
    };
    // pricing_rules has no natural unique key — the scope tuple identifies a seeded rule.
    const existing = await prisma.pricingRule.findFirst({ where: { jobType: seed.jobType, zoneId: null, vehicleTypeId, categoryId: null } });
    if (existing) await prisma.pricingRule.update({ where: { id: existing.id }, data });
    else await prisma.pricingRule.create({ data });
  }
  summary.set('pricing rules', RULES.length);

  /* ------------------------------------------------------------ commission */
  const commission = await prisma.commissionPolicy.findFirst({ where: { scope: CommissionScope.GLOBAL, jobType: null, categoryId: null, zoneId: null, partnerId: null } });
  const commissionData = { scope: CommissionScope.GLOBAL, percent: new Prisma.Decimal(15), fixedMinor: 0n, priority: 0, validFrom: now, validTo: null, isActive: true };
  if (commission) await prisma.commissionPolicy.update({ where: { id: commission.id }, data: commissionData });
  else await prisma.commissionPolicy.create({ data: commissionData });
  summary.note('commission: GLOBAL 15 %');

  /* ---------------------------------------------------------- cancellation */
  const cancellationData = {
    jobType: null,
    zoneId: null,
    currency,
    gracePeriodSeconds: 120,
    feeBeforeArrivalMinor: shekels(5), // 500 agorot
    feeAfterArrivalMinor: shekels(10), // 1000 agorot
    feeAfterStartMinor: 0n,
    partnerFeeOnCancelMinor: 0n,
    partnerPenaltyPoints: 1,
    customerNoShowFeeMinor: 0n,
    isActive: true,
  };
  const cancellation = await prisma.cancellationPolicy.findFirst({ where: { jobType: null, zoneId: null } });
  if (cancellation) await prisma.cancellationPolicy.update({ where: { id: cancellation.id }, data: cancellationData });
  else await prisma.cancellationPolicy.create({ data: cancellationData });
  summary.note('cancellation: 120 s grace, 5 ILS before arrival, 10 ILS after arrival');

  /* ------------------------------------------------------------- referral */
  const referralData = {
    inviterRewardMinor: shekels(10), // 1000 agorot
    inviteeRewardMinor: shekels(10),
    currency,
    rewardOn: 'FIRST_COMPLETED_JOB',
    minFirstJobMinor: 0n,
    maxRewardsPerInviter: 50,
    codeExpiryDays: 90,
    isActive: true,
  };
  const referral = await prisma.referralProgram.findFirst({ where: { isActive: true } });
  if (referral) await prisma.referralProgram.update({ where: { id: referral.id }, data: referralData });
  else await prisma.referralProgram.create({ data: referralData });
  summary.note('referral: 10 ILS inviter + 10 ILS invitee on the first completed job');

  /* ---------------------------------------------------------------- promo */
  const promoData = {
    description: 'خصم ترحيبي 10 % على أول طلب — Welcome discount on the first order',
    type: PromoType.PERCENTAGE,
    value: new Prisma.Decimal(10),
    maxDiscountMinor: shekels(15), // 1500 agorot
    minOrderMinor: 0n,
    currency,
    startsAt: now,
    endsAt: null,
    usageLimit: null,
    perUserLimit: 1,
    firstOrderOnly: true,
    jobTypes: [],
    paymentMethods: [],
    isActive: true,
  };
  await prisma.promoCode.upsert({ where: { code: 'WELCOME10' }, update: promoData, create: { code: 'WELCOME10', ...promoData } });
  summary.note('promo WELCOME10: 10 % up to 15 ILS, first order only');
}
