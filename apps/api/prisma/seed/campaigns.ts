import {
  BannerActionType,
  BannerAudience,
  BannerPlacement,
  type BannerTheme,
  CampaignStatus,
  MediaKind,
  MediaPurpose,
  MediaStatus,
} from '@tamam/shared-types';

import type { CatalogSeedResult } from './catalog';
import type { SeedContext } from './context';
import { SEED_ASSET_SPECS } from './png';
import type { ZoneSeedResult } from './zones';

const CAMPAIGN_NAME = 'TAMAM launch — Ramallah, Nablus, Hebron';

interface BannerSeed {
  placement: BannerPlacement;
  sortOrder: number;
  priority: number;
  headlineAr: string;
  headlineEn: string;
  subheadlineAr: string;
  subheadlineEn: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  badgeAr: string | null;
  badgeEn: string | null;
  theme: BannerTheme;
  actionType: BannerActionType;
  /** Resolved at seed time — `SERVICE_CATEGORY` needs the seeded category id. */
  actionValue: string | { categorySlug: string };
  imageArKey: string;
  imageEnKey: string;
}

const BANNERS: BannerSeed[] = [
  {
    placement: BannerPlacement.HOME_HERO,
    sortOrder: 1,
    priority: 100,
    headlineAr: 'كل خدمات بيتك في مكان واحد',
    headlineEn: 'Every home service in one place',
    subheadlineAr: 'سباك، كهربائي، تكييف — فنيون معتمدون',
    subheadlineEn: 'Plumbers, electricians, AC — vetted technicians',
    ctaLabelAr: 'اطلب الآن',
    ctaLabelEn: 'Book now',
    badgeAr: 'جديد',
    badgeEn: 'New',
    theme: 'purple',
    actionType: BannerActionType.DEEP_LINK,
    actionValue: 'tamam://services/plumbing',
    imageArKey: 'seed/banners/home-hero-ar.png',
    imageEnKey: 'seed/banners/home-hero-en.png',
  },
  {
    placement: BannerPlacement.HOME_HERO,
    sortOrder: 2,
    priority: 90,
    headlineAr: 'خصم 10 % على أول طلب',
    headlineEn: '10 % off your first order',
    subheadlineAr: 'استخدم كود WELCOME10',
    subheadlineEn: 'Use code WELCOME10',
    ctaLabelAr: 'استخدم الكود',
    ctaLabelEn: 'Apply code',
    badgeAr: 'عرض',
    badgeEn: 'Offer',
    theme: 'yellow',
    actionType: BannerActionType.PROMO_CODE,
    actionValue: 'WELCOME10',
    imageArKey: 'seed/banners/home-hero-en.png',
    imageEnKey: 'seed/banners/home-hero-ar.png',
  },
  {
    placement: BannerPlacement.HOME_INLINE,
    sortOrder: 1,
    priority: 50,
    headlineAr: 'تنظيف بالساعة',
    headlineEn: 'Cleaning by the hour',
    subheadlineAr: '60 شيكل للساعة — احجز اليوم',
    subheadlineEn: '60 ILS per hour — book today',
    ctaLabelAr: 'احجز',
    ctaLabelEn: 'Book',
    badgeAr: null,
    badgeEn: null,
    theme: 'yellow',
    actionType: BannerActionType.SERVICE_CATEGORY,
    actionValue: { categorySlug: 'cleaning' },
    imageArKey: 'seed/banners/home-inline.png',
    imageEnKey: 'seed/banners/home-inline.png',
  },
];

/**
 * One live campaign so the customer app has real banners to render on first run.
 *
 * The MediaAsset rows point at object keys in the **public** bucket; the bytes themselves are
 * generated into `infrastructure/docker/seed-assets/` and uploaded by `scripts/seed-assets.sh`.
 * Until that script runs, the rows are valid and the URLs simply 404.
 */
export async function seedCampaign(
  ctx: SeedContext,
  catalog: CatalogSeedResult,
  zones: ZoneSeedResult,
  createdById: string,
): Promise<void> {
  const { prisma, config, summary } = ctx;

  const mediaByKey = new Map<string, string>();
  for (const spec of SEED_ASSET_SPECS.filter((s) => s.bucket === 'public')) {
    const row = await prisma.mediaAsset.upsert({
      where: { objectKey: spec.objectKey },
      update: { status: MediaStatus.READY, isPublic: true, bucket: config.env.S3_BUCKET_PUBLIC },
      create: {
        kind: MediaKind.IMAGE,
        purpose: MediaPurpose.BANNER_CREATIVE,
        status: MediaStatus.READY,
        bucket: config.env.S3_BUCKET_PUBLIC,
        objectKey: spec.objectKey,
        mimeType: 'image/png',
        sizeBytes: 0n,
        width: spec.width,
        height: spec.height,
        originalFilename: spec.relativePath.split('/').pop() ?? spec.relativePath,
        exifStripped: true,
        scanStatus: 'CLEAN',
        isPublic: true,
      },
    });
    mediaByKey.set(spec.objectKey, row.id);
  }
  summary.set('banner media assets', mediaByKey.size);

  const campaignData = {
    description: 'حملة الإطلاق — Launch campaign seeded for development',
    status: CampaignStatus.ACTIVE,
    startsAt: new Date(Date.now() - 86_400_000),
    endsAt: null,
    audiences: [BannerAudience.CUSTOMER],
    languages: [],
    platforms: [],
    newCustomersOnly: false,
    rolloutPercent: 100,
    frequencyCapPerDay: null,
    createdById,
    publishedById: createdById,
    publishedAt: new Date(),
  };
  const existing = await prisma.campaign.findFirst({ where: { name: CAMPAIGN_NAME } });
  const campaign = existing
    ? await prisma.campaign.update({ where: { id: existing.id }, data: campaignData })
    : await prisma.campaign.create({ data: { name: CAMPAIGN_NAME, ...campaignData } });

  await prisma.campaignZone.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaignZone.createMany({
    data: [...zones.zoneIds.values()].map((zoneId) => ({ campaignId: campaign.id, zoneId })),
  });

  for (const seed of BANNERS) {
    const imageArMediaId = mediaByKey.get(seed.imageArKey);
    const imageEnMediaId = mediaByKey.get(seed.imageEnKey);
    if (!imageArMediaId || !imageEnMediaId)
      throw new Error(`banner creative missing for ${seed.placement}`);
    const actionValue =
      typeof seed.actionValue === 'string'
        ? seed.actionValue
        : (catalog.categoryIds.get(seed.actionValue.categorySlug) ?? null);
    if (!actionValue) throw new Error(`banner action target missing for ${seed.placement}`);

    const data = {
      placement: seed.placement,
      headlineAr: seed.headlineAr,
      headlineEn: seed.headlineEn,
      subheadlineAr: seed.subheadlineAr,
      subheadlineEn: seed.subheadlineEn,
      ctaLabelAr: seed.ctaLabelAr,
      ctaLabelEn: seed.ctaLabelEn,
      badgeAr: seed.badgeAr,
      badgeEn: seed.badgeEn,
      imageArMediaId,
      imageEnMediaId,
      theme: seed.theme,
      actionType: seed.actionType,
      actionValue,
      priority: seed.priority,
      sortOrder: seed.sortOrder,
      isActive: true,
    };
    // banners has no natural unique key — (campaign, placement, sortOrder) identifies a seeded row.
    const current = await prisma.banner.findFirst({
      where: { campaignId: campaign.id, placement: seed.placement, sortOrder: seed.sortOrder },
    });
    if (current) await prisma.banner.update({ where: { id: current.id }, data });
    else await prisma.banner.create({ data: { campaignId: campaign.id, ...data } });
  }
  summary.set('banners', BANNERS.length);
  summary.note('run `bash scripts/seed-assets.sh` to upload the placeholder creatives to MinIO/S3');
}
