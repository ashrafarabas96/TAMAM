import { Injectable } from '@nestjs/common';
import {
  type BannerDto,
  type BannerFeedDto,
  BannerEventType,
  BannerPlacement,
  CONFIG_KEYS,
  CampaignStatus,
  FEATURE_FLAGS,
  type JobType,
  type LocalizedText,
} from '@tamam/shared-types';
import type { BannerFeedQueryInput } from '@tamam/validation';

import type { RequestUser } from '../../common/types/request-user';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemConfigService } from '../config/system-config.service';
import { MediaUrlService } from '../media/media-url.service';
import { ZonesService } from '../zones/zones.service';

import { type CandidateBanner, type CandidateCampaign, PLACEMENT_LIMITS, bannerMediaSelect } from './campaigns.types';
import {
  ANONYMOUS_VIEWER_ID,
  type BannerViewer,
  type TargetableCampaign,
  compareBannerOrder,
  isLiveAt,
  matchesTargeting,
} from './domain/banner-targeting';
import { signBannerToken } from './domain/banner-token';

/** Redis key holding the candidate campaigns of one placement (targeting is applied after the cache). */
export const candidatesKey = (placement: BannerPlacement): string => `banners:candidates:${placement}`;
/** Redis key holding today's impression count of one user for one campaign (frequency capping). */
export const frequencyKey = (userId: string, campaignId: string, day: string): string => `banners:freq:${userId}:${campaignId}:${day}`;
/** Redis key of the resolved viewer profile (completed jobs / service history). */
const viewerKey = (userId: string, audience: string): string => `banners:viewer:${userId}:${audience}`;

const VIEWER_CACHE_S = 120;
/**
 * Extra lifetime granted to a tracking token beyond the feed cache window. Clients batch
 * banner events and may flush them long after the feed was rendered (offline, backgrounded).
 */
const TOKEN_GRACE_S = 24 * 3600;
/** Safety bound on how many ACTIVE campaigns a single placement may consider. */
const MAX_CANDIDATE_CAMPAIGNS = 200;

export interface ViewerProfile {
  completedJobs: number;
  isNewCustomer: boolean;
  usedJobTypes: JobType[];
}

export interface CandidateLoadOptions {
  /** Statuses to load. Defaults to ACTIVE only; preview also wants SCHEDULED. */
  statuses?: CampaignStatus[];
  /** Skip the Redis cache (admin preview always reads through). */
  bypassCache?: boolean;
}

export interface FeedBuildOptions {
  applyFrequencyCap: boolean;
  /** When false, campaigns that are not live right now are still returned (admin preview). */
  requireLive: boolean;
  statuses?: CampaignStatus[];
  bypassCache?: boolean;
}

/**
 * Builds the per-placement banner feed for a viewer (spec §80–§82).
 *
 * The expensive half — loading ACTIVE campaigns with their creatives — is cached per placement
 * in Redis for `banners.feed_cache_s`; the personal half (targeting, rollout, frequency cap) runs
 * on every request so two users never share a feed.
 */
@Injectable()
export class BannerFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly systemConfig: SystemConfigService,
    private readonly zones: ZonesService,
    private readonly mediaUrls: MediaUrlService,
    private readonly config: AppConfigService,
  ) {}

  /* --------------------------------------------------------------- feed */

  /**
   * @param language falls back for signed-out viewers (the app's `Accept-Language`); an
   * authenticated user's stored preference always wins.
   */
  async getFeed(user: RequestUser | null, query: BannerFeedQueryInput, language?: 'ar' | 'en'): Promise<BannerFeedDto> {
    const now = new Date();
    const cacheSeconds = await this.systemConfig.getNumber(CONFIG_KEYS.BANNER_FEED_CACHE_S);
    const cacheUntil = new Date(now.getTime() + cacheSeconds * 1000).toISOString();

    const zoneId = await this.resolveZoneId(query);
    const enabled = await this.systemConfig.isEnabled(FEATURE_FLAGS.PROMO_BANNERS, { userId: user?.id, zoneId });
    if (!enabled) return { placement: query.placement, banners: [], cacheUntil };

    // The partner app only ever asks for PARTNER_HOME, so the placement carries the audience.
    const audience = query.placement === BannerPlacement.PARTNER_HOME ? 'PARTNER' : 'CUSTOMER';
    const profile = await this.viewerProfile(user, audience);
    const viewer: BannerViewer = {
      userId: user?.id ?? ANONYMOUS_VIEWER_ID,
      audience,
      zoneId,
      language: user?.language ?? language ?? 'ar',
      ...(query.platform ? { platform: query.platform } : {}),
      completedJobs: profile.completedJobs,
      isNewCustomer: profile.isNewCustomer,
      usedJobTypes: profile.usedJobTypes,
    };

    const banners = await this.buildForViewer(viewer, query.placement, { applyFrequencyCap: true, requireLive: true });
    return { placement: query.placement, banners, cacheUntil };
  }

  /**
   * Core feed builder — also used by the admin targeting preview.
   * Ordering: priority desc, sortOrder asc, id (stable), capped at the placement's maxItems.
   */
  async buildForViewer(viewer: BannerViewer, placement: BannerPlacement, options: FeedBuildOptions): Promise<BannerDto[]> {
    const now = new Date();
    const loadOptions: CandidateLoadOptions = {
      ...(options.statuses ? { statuses: options.statuses } : {}),
      ...(options.bypassCache === undefined ? {} : { bypassCache: options.bypassCache }),
    };
    const candidates = await this.loadCandidates(placement, loadOptions);

    const eligible = candidates.filter((c) => {
      const targetable = toTargetable(c);
      if (options.requireLive && !isLiveAt(targetable, now)) return false;
      return matchesTargeting(targetable, viewer);
    });

    const allowed = options.applyFrequencyCap ? await this.applyFrequencyCap(eligible, viewer, now) : eligible;

    const rows = allowed
      .flatMap((campaign) => campaign.banners.filter((b) => b.isActive).map((banner) => ({ campaign, banner })))
      .sort((a, b) => compareBannerOrder(a.banner, b.banner));

    const limit = PLACEMENT_LIMITS[placement];
    const cacheSeconds = await this.systemConfig.getNumber(CONFIG_KEYS.BANNER_FEED_CACHE_S);
    const exp = Math.floor(now.getTime() / 1000) + cacheSeconds + TOKEN_GRACE_S;

    return rows.slice(0, limit).map(({ campaign, banner }) => this.toBannerDto(banner, campaign.id, viewer.userId, exp));
  }

  /* ------------------------------------------------------------ mapping */

  toBannerDto(banner: CandidateBanner, campaignId: string, subject: string, exp: number): BannerDto {
    return {
      id: banner.id,
      campaignId,
      placement: banner.placement,
      creative: {
        headline: localized(banner.headlineAr, banner.headlineEn),
        subheadline: localized(banner.subheadlineAr, banner.subheadlineEn),
        ctaLabel: localized(banner.ctaLabelAr, banner.ctaLabelEn),
        imageUrl: {
          ar: this.mediaUrls.urlFor(banner.imageAr, 'original'),
          en: this.mediaUrls.urlFor(banner.imageEn, 'original'),
        },
        theme: banner.theme,
        badge: localized(banner.badgeAr, banner.badgeEn),
      },
      actionType: banner.actionType,
      actionValue: banner.actionValue,
      priority: banner.priority,
      trackingToken: signBannerToken({ bannerId: banner.id, campaignId, subject, exp }, this.config.env.OTP_PEPPER),
    };
  }

  /** Token lifetime used when a DTO is built outside a feed request (admin preview, campaign detail). */
  async defaultTokenExpiry(now = new Date()): Promise<number> {
    const cacheSeconds = await this.systemConfig.getNumber(CONFIG_KEYS.BANNER_FEED_CACHE_S);
    return Math.floor(now.getTime() / 1000) + cacheSeconds + TOKEN_GRACE_S;
  }

  /* ---------------------------------------------------------- candidates */

  /** Loads the campaigns that own at least one active banner for the placement. */
  async loadCandidates(placement: BannerPlacement, options: CandidateLoadOptions = {}): Promise<CandidateCampaign[]> {
    const statuses = options.statuses ?? [CampaignStatus.ACTIVE];
    const cacheable = !options.bypassCache && statuses.length === 1 && statuses[0] === CampaignStatus.ACTIVE;

    if (cacheable) {
      const cached = await this.redis.getJson<CandidateCampaign[]>(candidatesKey(placement));
      if (cached) return cached;
    }

    const rows = await this.prisma.campaign.findMany({
      // Schedule bounds are re-checked per request by `isLiveAt` so a cached list can never
      // serve an expired campaign — that keeps the cache key free of time.
      where: { status: { in: statuses }, banners: { some: { placement, isActive: true } } },
      include: {
        zones: { select: { zoneId: true } },
        banners: {
          where: { placement, isActive: true },
          orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }],
          include: { imageAr: { select: bannerMediaSelect }, imageEn: { select: bannerMediaSelect } },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: MAX_CANDIDATE_CAMPAIGNS,
    });

    const candidates: CandidateCampaign[] = rows.map((c) => ({
      id: c.id,
      status: c.status,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt ? c.endsAt.toISOString() : null,
      audiences: c.audiences,
      zoneIds: c.zones.map((z) => z.zoneId),
      languages: c.languages,
      platforms: c.platforms,
      newCustomersOnly: c.newCustomersOnly,
      minCompletedJobs: c.minCompletedJobs,
      maxCompletedJobs: c.maxCompletedJobs,
      serviceTypeInterest: c.serviceTypeInterest,
      rolloutPercent: c.rolloutPercent,
      frequencyCapPerDay: c.frequencyCapPerDay,
      banners: c.banners.map((b) => ({
        id: b.id,
        placement: b.placement,
        headlineAr: b.headlineAr,
        headlineEn: b.headlineEn,
        subheadlineAr: b.subheadlineAr,
        subheadlineEn: b.subheadlineEn,
        ctaLabelAr: b.ctaLabelAr,
        ctaLabelEn: b.ctaLabelEn,
        badgeAr: b.badgeAr,
        badgeEn: b.badgeEn,
        imageAr: b.imageAr,
        imageEn: b.imageEn,
        theme: b.theme,
        actionType: b.actionType,
        actionValue: b.actionValue,
        priority: b.priority,
        sortOrder: b.sortOrder,
        isActive: b.isActive,
      })),
    }));

    if (cacheable) {
      const ttl = await this.systemConfig.getNumber(CONFIG_KEYS.BANNER_FEED_CACHE_S);
      await this.redis.setJson(candidatesKey(placement), candidates, ttl);
    }
    return candidates;
  }

  /** Drops every cached candidate list — called after any campaign or banner change. */
  async invalidateCandidateCache(): Promise<void> {
    await this.redis.del(...Object.values(BannerPlacement).map((p) => candidatesKey(p)));
  }

  /* ------------------------------------------------------ frequency cap */

  /**
   * Removes campaigns the viewer has already seen `frequencyCapPerDay` times today. Counts live in
   * Redis (maintained on impression ingestion, UTC day buckets); a missing counter is rebuilt from
   * `banner_events` so a Redis eviction can never silently reset a cap. Anonymous viewers have no
   * durable identity, so caps do not apply to them.
   */
  private async applyFrequencyCap(campaigns: CandidateCampaign[], viewer: BannerViewer, now: Date): Promise<CandidateCampaign[]> {
    const capped = campaigns.filter((c) => c.frequencyCapPerDay !== null && c.frequencyCapPerDay > 0);
    if (!capped.length || viewer.userId === ANONYMOUS_VIEWER_ID) return campaigns;

    const day = utcDayKey(now);
    const keys = capped.map((c) => frequencyKey(viewer.userId, c.id, day));
    const cachedCounts = await this.redis.client.mget(...keys);

    const counts = new Map<string, number>();
    const missing: string[] = [];
    capped.forEach((campaign, index) => {
      const raw = cachedCounts[index];
      const parsed = raw === null || raw === undefined ? Number.NaN : Number(raw);
      if (Number.isFinite(parsed)) counts.set(campaign.id, parsed);
      else missing.push(campaign.id);
    });

    if (missing.length) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const grouped = await this.prisma.bannerEvent.groupBy({
        by: ['campaignId'],
        where: { userId: viewer.userId, campaignId: { in: missing }, type: BannerEventType.IMPRESSION, occurredAt: { gte: dayStart } },
        _count: { _all: true },
      });
      const fromDb = new Map<string, number>(grouped.map((g) => [g.campaignId, g._count._all]));
      const ttl = secondsUntilNextUtcDay(now);
      for (const campaignId of missing) {
        const value = fromDb.get(campaignId) ?? 0;
        counts.set(campaignId, value);
        await this.redis.client.set(frequencyKey(viewer.userId, campaignId, day), String(value), 'EX', ttl);
      }
    }

    return campaigns.filter((c) => {
      const cap = c.frequencyCapPerDay;
      if (cap === null || cap <= 0) return true;
      return (counts.get(c.id) ?? 0) < cap;
    });
  }

  /* ------------------------------------------------------------- viewer */

  private async resolveZoneId(query: BannerFeedQueryInput): Promise<string | null> {
    if (query.zoneId) return query.zoneId;
    if (query.lat === undefined || query.lng === undefined) return null;
    const zone = await this.zones.resolveZoneForPoint(query.lat, query.lng);
    return zone?.id ?? null;
  }

  /** Completed-job counts and service history drive the behavioural targeting rules. */
  async viewerProfile(user: RequestUser | null, audience: 'CUSTOMER' | 'PARTNER'): Promise<ViewerProfile> {
    if (!user) return { completedJobs: 0, isNewCustomer: true, usedJobTypes: [] };

    const cached = await this.redis.getJson<ViewerProfile>(viewerKey(user.id, audience));
    if (cached) return cached;

    let profile: ViewerProfile;
    if (audience === 'PARTNER') {
      const [partner, types] = await Promise.all([
        this.prisma.partnerProfile.findUnique({ where: { userId: user.id }, select: { completedJobs: true, createdAt: true } }),
        this.prisma.job.groupBy({ by: ['type'], where: { partnerId: user.id } }),
      ]);
      profile = {
        completedJobs: partner?.completedJobs ?? 0,
        isNewCustomer: false,
        usedJobTypes: types.map((t) => t.type),
      };
    } else {
      const [customer, types] = await Promise.all([
        this.prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { completedJobs: true, firstJobAt: true } }),
        this.prisma.job.groupBy({ by: ['type'], where: { customerId: user.id } }),
      ]);
      profile = {
        completedJobs: customer?.completedJobs ?? 0,
        isNewCustomer: !customer || customer.firstJobAt === null,
        usedJobTypes: types.map((t) => t.type),
      };
    }

    await this.redis.setJson(viewerKey(user.id, audience), profile, VIEWER_CACHE_S);
    return profile;
  }
}

/* --------------------------------------------------------------- helpers */

export function toTargetable(campaign: CandidateCampaign): TargetableCampaign {
  return {
    id: campaign.id,
    status: campaign.status,
    startsAt: new Date(campaign.startsAt),
    endsAt: campaign.endsAt ? new Date(campaign.endsAt) : null,
    audiences: campaign.audiences,
    zoneIds: campaign.zoneIds,
    languages: campaign.languages,
    platforms: campaign.platforms,
    newCustomersOnly: campaign.newCustomersOnly,
    minCompletedJobs: campaign.minCompletedJobs,
    maxCompletedJobs: campaign.maxCompletedJobs,
    serviceTypeInterest: campaign.serviceTypeInterest,
    rolloutPercent: campaign.rolloutPercent,
  };
}

/** `{ ar, en }` or null when the creative carries the text in the image itself. */
export function localized(ar: string | null, en: string | null): LocalizedText | null {
  if (!ar && !en) return null;
  return { ar: ar ?? en ?? '', en: en ?? ar ?? '' };
}

export const utcDayKey = (d: Date): string =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

export function secondsUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}
