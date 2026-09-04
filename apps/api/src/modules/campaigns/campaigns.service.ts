import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type BannerDto,
  type BannerPlacement,
  type CampaignDto,
  type CampaignStatsDto,
  CampaignStatus,
  type CampaignTargetingDto,
  ErrorCode,
  type JobType,
  type Language,
  type Page,
  Permission,
} from '@tamam/shared-types';
import type {
  BannerInput,
  CampaignStatusActionInput,
  UpsertCampaignInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { BannerFeedService } from './banner-feed.service';
import { type CandidateBanner, bannerMediaSelect } from './campaigns.types';
import { ANONYMOUS_VIEWER_ID, type BannerViewer } from './domain/banner-targeting';

type CampaignStatusAction = CampaignStatusActionInput['action'];

export interface CampaignListFilter {
  status?: CampaignStatus;
  q?: string;
  cursor?: string;
  limit: number;
}

export interface CampaignPreviewInput {
  placement: BannerPlacement;
  audience: 'CUSTOMER' | 'PARTNER';
  zoneId?: string;
  language: 'ar' | 'en';
  platform?: 'ios' | 'android' | 'web';
  completedJobs: number;
  isNewCustomer: boolean;
  usedJobTypes: JobType[];
  /** Optional real user id so rollout bucketing matches what that user would see. */
  userId?: string;
}

/** Statuses each action may be applied to (spec §81 campaign workflow). */
const LEGAL_FROM: Record<CampaignStatusAction, CampaignStatus[]> = {
  PUBLISH: [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED],
  PAUSE: [CampaignStatus.ACTIVE],
  RESUME: [CampaignStatus.PAUSED],
  END: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.SCHEDULED],
  ARCHIVE: [CampaignStatus.ENDED, CampaignStatus.DRAFT],
};

/** Actions that change who sees banners in production and therefore need CAMPAIGNS_PUBLISH. */
const PUBLISH_ACTIONS: CampaignStatusAction[] = ['PUBLISH', 'RESUME'];

const campaignInclude = {
  zones: { select: { zoneId: true } },
  banners: {
    orderBy: [{ priority: 'desc' as const }, { sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: { imageAr: { select: bannerMediaSelect }, imageEn: { select: bannerMediaSelect } },
  },
} satisfies Prisma.CampaignInclude;

type CampaignWithRelations = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;
type CampaignBannerRow = Prisma.BannerGetPayload<{
  include: {
    imageAr: { select: typeof bannerMediaSelect };
    imageEn: { select: typeof bannerMediaSelect };
  };
}>;

interface PlacementAggregate {
  placement: string;
  impressions: number;
  unique_impressions: number;
  clicks: number;
  dismissals: number;
}

/**
 * Admin CRUD, the publishing workflow and reporting for promotional campaigns (spec §80–§82).
 * Every write invalidates the per-placement candidate caches the feed reads.
 */
@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly feed: BannerFeedService,
  ) {}

  /* ---------------------------------------------------------------- read */

  /**
   * Keyset-paginated list. The embedded stats are lifetime totals from `banner_daily_stats`
   * (no per-day/per-placement breakdown and no live same-day numbers) — call `stats()` for those.
   */
  async list(filter: CampaignListFilter): Promise<Page<CampaignDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.campaign.findMany({
      where: {
        ...cursorWhere(cursor),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' as const } } : {}),
      },
      include: campaignInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });

    const summaries = await this.lifetimeStats(rows.map((r) => r.id));
    const exp = await this.feed.defaultTokenExpiry();
    return buildPage(rows, filter.limit, (row) =>
      this.toDto(row, summaries.get(row.id) ?? emptyStats(), exp),
    );
  }

  async get(id: string): Promise<CampaignDto> {
    const row = await this.prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
    if (!row) throw AppException.notFound('Campaign', id);
    const [stats, exp] = await Promise.all([this.stats(id), this.feed.defaultTokenExpiry()]);
    return this.toDto(row, stats, exp);
  }

  /* --------------------------------------------------------------- write */

  async create(
    input: UpsertCampaignInput,
    actor: RequestUser,
    requestId: string | null,
  ): Promise<CampaignDto> {
    await this.validateInput(input);

    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          status: CampaignStatus.DRAFT,
          startsAt: new Date(input.startsAt),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          audiences: input.targeting.audiences,
          languages: input.targeting.languages,
          platforms: input.targeting.platforms,
          newCustomersOnly: input.targeting.newCustomersOnly,
          minCompletedJobs: input.targeting.minCompletedJobs ?? null,
          maxCompletedJobs: input.targeting.maxCompletedJobs ?? null,
          serviceTypeInterest: input.targeting.serviceTypeInterest,
          rolloutPercent: input.targeting.rolloutPercent,
          frequencyCapPerDay: input.frequencyCapPerDay ?? null,
          createdById: actor.id,
        },
      });
      await this.replaceZones(tx, campaign.id, input.targeting.zoneIds);
      for (const banner of input.banners) {
        await tx.banner.create({ data: { campaignId: campaign.id, ...bannerData(banner) } });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'campaign.create',
          entity: 'campaign',
          entityId: campaign.id,
          newValue: { name: input.name, banners: input.banners.length },
          requestId,
        },
        tx,
      );
      return campaign.id;
    });

    await this.feed.invalidateCandidateCache();
    return this.get(created);
  }

  /**
   * Replaces the campaign's banner set. Banners missing from the payload are removed when they
   * have no recorded events, and deactivated otherwise — deleting them would cascade away their
   * `banner_events` / `banner_daily_stats` history (CONVENTIONS §5: never delete operational data).
   */
  async update(
    id: string,
    input: UpsertCampaignInput,
    actor: RequestUser,
    requestId: string | null,
  ): Promise<CampaignDto> {
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    });
    if (!existing) throw AppException.notFound('Campaign', id);
    if (existing.status === CampaignStatus.ARCHIVED) {
      throw AppException.conflict(
        'An archived campaign can no longer be edited',
        ErrorCode.INVALID_STATE_TRANSITION,
      );
    }
    await this.validateInput(input);

    const providedIds = input.banners
      .map((b) => b.id)
      .filter((v): v is string => typeof v === 'string');
    const currentBanners = await this.prisma.banner.findMany({
      where: { campaignId: id },
      select: { id: true },
    });
    const currentIds = new Set(currentBanners.map((b) => b.id));
    for (const providedId of providedIds) {
      if (!currentIds.has(providedId))
        throw AppException.validation([
          { field: 'banners.id', message: `banner ${providedId} does not belong to this campaign` },
        ]);
    }

    const removed = currentBanners
      .map((b) => b.id)
      .filter((bannerId) => !providedIds.includes(bannerId));
    const withEvents = removed.length
      ? new Set(
          (
            await this.prisma.bannerEvent.groupBy({
              by: ['bannerId'],
              where: { bannerId: { in: removed } },
              _count: { _all: true },
            })
          ).map((g) => g.bannerId),
        )
      : new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      const deletable = removed.filter((bannerId) => !withEvents.has(bannerId));
      const retirable = removed.filter((bannerId) => withEvents.has(bannerId));
      if (deletable.length) await tx.banner.deleteMany({ where: { id: { in: deletable } } });
      if (retirable.length)
        await tx.banner.updateMany({ where: { id: { in: retirable } }, data: { isActive: false } });

      for (const banner of input.banners) {
        if (banner.id && currentIds.has(banner.id))
          await tx.banner.update({ where: { id: banner.id }, data: bannerData(banner) });
        else await tx.banner.create({ data: { campaignId: id, ...bannerData(banner) } });
      }

      await tx.campaign.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description ?? null,
          startsAt: new Date(input.startsAt),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          audiences: input.targeting.audiences,
          languages: input.targeting.languages,
          platforms: input.targeting.platforms,
          newCustomersOnly: input.targeting.newCustomersOnly,
          minCompletedJobs: input.targeting.minCompletedJobs ?? null,
          maxCompletedJobs: input.targeting.maxCompletedJobs ?? null,
          serviceTypeInterest: input.targeting.serviceTypeInterest,
          rolloutPercent: input.targeting.rolloutPercent,
          frequencyCapPerDay: input.frequencyCapPerDay ?? null,
        },
      });
      await this.replaceZones(tx, id, input.targeting.zoneIds);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'campaign.update',
          entity: 'campaign',
          entityId: id,
          oldValue: { name: existing.name },
          newValue: {
            name: input.name,
            banners: input.banners.length,
            retiredBanners: retirable.length,
            deletedBanners: deletable.length,
          },
          requestId,
        },
        tx,
      );
    });

    await this.feed.invalidateCandidateCache();
    return this.get(id);
  }

  /** Runs one workflow action, enforcing the legal transitions and the publish permission. */
  async changeStatus(
    id: string,
    action: CampaignStatusAction,
    actor: RequestUser,
    requestId: string | null,
    reason?: string,
  ): Promise<CampaignDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { id: true, status: true, startsAt: true, endsAt: true, publishedAt: true },
    });
    if (!campaign) throw AppException.notFound('Campaign', id);

    if (
      PUBLISH_ACTIONS.includes(action) &&
      !actor.isSuperAdmin &&
      !actor.permissions.includes(Permission.CAMPAIGNS_PUBLISH)
    ) {
      throw AppException.forbidden(
        'Publishing a campaign requires the campaigns.publish permission',
      );
    }

    const allowedFrom = LEGAL_FROM[action];
    if (!allowedFrom.includes(campaign.status)) {
      throw AppException.conflict(
        `Cannot ${action} a campaign in status ${campaign.status}`,
        ErrorCode.INVALID_STATE_TRANSITION,
        { from: campaign.status, action },
      );
    }

    const now = new Date();
    // Unchecked variant: every field written here is a plain column (`published_by_id` has no
    // Prisma relation), never a nested relation write.
    const data: Prisma.CampaignUncheckedUpdateInput = {};
    let next: CampaignStatus;

    switch (action) {
      case 'PUBLISH':
        next =
          campaign.startsAt.getTime() <= now.getTime()
            ? CampaignStatus.ACTIVE
            : CampaignStatus.SCHEDULED;
        data.publishedById = actor.id;
        data.publishedAt = campaign.publishedAt ?? now;
        break;
      case 'PAUSE':
        next = CampaignStatus.PAUSED;
        data.pausedAt = now;
        break;
      case 'RESUME':
        next =
          campaign.startsAt.getTime() <= now.getTime()
            ? CampaignStatus.ACTIVE
            : CampaignStatus.SCHEDULED;
        data.pausedAt = null;
        break;
      case 'END':
        next = CampaignStatus.ENDED;
        data.endedAt = now;
        break;
      case 'ARCHIVE':
        next = CampaignStatus.ARCHIVED;
        break;
    }
    data.status = next;

    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id }, data });
      await this.audit.record(
        {
          actorId: actor.id,
          action: `campaign.${action.toLowerCase()}`,
          entity: 'campaign',
          entityId: id,
          oldValue: { status: campaign.status },
          newValue: { status: next },
          reason: reason ?? null,
          requestId,
        },
        tx,
      );
    });

    await this.feed.invalidateCandidateCache();
    return this.get(id);
  }

  /* ----------------------------------------------------------- scheduler */

  /** SCHEDULED → ACTIVE once `startsAt` has passed. Called by the campaign scheduler job. */
  async activateScheduled(now = new Date()): Promise<{ activated: number }> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      data: { status: CampaignStatus.ACTIVE },
    });
    if (result.count) await this.feed.invalidateCandidateCache();
    return { activated: result.count };
  }

  /** ACTIVE/SCHEDULED → ENDED once `endsAt` has passed. Called by the campaign scheduler job. */
  async endExpired(now = new Date()): Promise<{ ended: number }> {
    const result = await this.prisma.campaign.updateMany({
      where: {
        status: { in: [CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED] },
        endsAt: { not: null, lte: now },
      },
      data: { status: CampaignStatus.ENDED, endedAt: now },
    });
    if (result.count) await this.feed.invalidateCandidateCache();
    return { ended: result.count };
  }

  /* -------------------------------------------------------------- stats */

  /**
   * Campaign performance from `banner_daily_stats`, with the current (not yet rolled up) day
   * computed live from `banner_events` so the dashboard is never a day behind.
   */
  async stats(id: string, from?: string, to?: string): Promise<CampaignStatsDto> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { startsAt: true },
    });
    if (!campaign) throw AppException.notFound('Campaign', id);

    const now = new Date();
    const todayStart = utcMidnight(now);
    const fromDate = utcMidnight(from ? new Date(from) : campaign.startsAt);
    const toDate = utcMidnight(to ? new Date(to) : now);
    const includeToday = toDate.getTime() >= todayStart.getTime();
    const historyEnd = new Date(Math.min(toDate.getTime(), todayStart.getTime() - 86_400_000));

    const daily =
      historyEnd.getTime() >= fromDate.getTime()
        ? await this.prisma.bannerDailyStat.findMany({
            where: { campaignId: id, date: { gte: fromDate, lte: historyEnd } },
            orderBy: [{ date: 'asc' }],
          })
        : [];

    const totals = {
      impressions: 0,
      uniqueImpressions: 0,
      clicks: 0,
      dismissals: 0,
      conversions: 0,
    };
    const byPlacement = new Map<string, { impressions: number; clicks: number }>();
    const byDay = new Map<string, { impressions: number; clicks: number }>();

    for (const row of daily) {
      totals.impressions += row.impressions;
      totals.uniqueImpressions += row.uniqueImpressions;
      totals.clicks += row.clicks;
      totals.dismissals += row.dismissals;
      totals.conversions += row.conversions;
      const p = byPlacement.get(row.placement) ?? { impressions: 0, clicks: 0 };
      p.impressions += row.impressions;
      p.clicks += row.clicks;
      byPlacement.set(row.placement, p);
      const key = row.date.toISOString().slice(0, 10);
      const d = byDay.get(key) ?? { impressions: 0, clicks: 0 };
      d.impressions += row.impressions;
      d.clicks += row.clicks;
      byDay.set(key, d);
    }

    if (includeToday) {
      const [live, conversionsToday] = await Promise.all([
        this.prisma.$queryRaw<PlacementAggregate[]>`
          SELECT placement::text AS placement,
                 COUNT(*) FILTER (WHERE type = 'IMPRESSION')::int AS impressions,
                 COUNT(DISTINCT CASE WHEN type = 'IMPRESSION' THEN COALESCE(user_id::text, session_id) END)::int AS unique_impressions,
                 COUNT(*) FILTER (WHERE type = 'CLICK')::int AS clicks,
                 COUNT(*) FILTER (WHERE type = 'DISMISS')::int AS dismissals
          FROM banner_events
          WHERE campaign_id = ${id}::uuid AND occurred_at >= ${todayStart}
          GROUP BY 1`,
        this.prisma.job.count({
          where: { attributedCampaignId: id, createdAt: { gte: todayStart } },
        }),
      ]);

      const todayKey = todayStart.toISOString().slice(0, 10);
      for (const row of live) {
        totals.impressions += Number(row.impressions);
        totals.uniqueImpressions += Number(row.unique_impressions);
        totals.clicks += Number(row.clicks);
        totals.dismissals += Number(row.dismissals);
        const p = byPlacement.get(row.placement) ?? { impressions: 0, clicks: 0 };
        p.impressions += Number(row.impressions);
        p.clicks += Number(row.clicks);
        byPlacement.set(row.placement, p);
        const d = byDay.get(todayKey) ?? { impressions: 0, clicks: 0 };
        d.impressions += Number(row.impressions);
        d.clicks += Number(row.clicks);
        byDay.set(todayKey, d);
      }
      totals.conversions += conversionsToday;
    }

    return {
      impressions: totals.impressions,
      uniqueImpressions: totals.uniqueImpressions,
      clicks: totals.clicks,
      dismissals: totals.dismissals,
      ctr: ratio(totals.clicks, totals.impressions),
      conversions: totals.conversions,
      byPlacement: [...byPlacement.entries()].map(([placement, v]) => ({
        placement: placement as BannerPlacement,
        impressions: v.impressions,
        clicks: v.clicks,
        ctr: ratio(v.clicks, v.impressions),
      })),
      byDay: [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, v]) => ({ date, impressions: v.impressions, clicks: v.clicks })),
    };
  }

  /* ------------------------------------------------------------ preview */

  /**
   * What a given viewer profile would see right now. Frequency caps are ignored (they depend on
   * the real viewer's history) and SCHEDULED campaigns are included so admins can check upcoming
   * targeting before publishing.
   */
  async preview(input: CampaignPreviewInput): Promise<BannerDto[]> {
    const viewer: BannerViewer = {
      userId: input.userId ?? ANONYMOUS_VIEWER_ID,
      audience: input.audience,
      zoneId: input.zoneId ?? null,
      language: input.language,
      ...(input.platform ? { platform: input.platform } : {}),
      completedJobs: input.completedJobs,
      isNewCustomer: input.isNewCustomer,
      usedJobTypes: input.usedJobTypes,
    };
    return this.feed.buildForViewer(viewer, input.placement, {
      applyFrequencyCap: false,
      requireLive: false,
      statuses: [CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED],
      bypassCache: true,
    });
  }

  /* ------------------------------------------------------------ helpers */

  private async replaceZones(tx: Tx, campaignId: string, zoneIds: string[]): Promise<void> {
    await tx.campaignZone.deleteMany({ where: { campaignId } });
    const unique = [...new Set(zoneIds)];
    if (unique.length)
      await tx.campaignZone.createMany({
        data: unique.map((zoneId) => ({ campaignId, zoneId })),
        skipDuplicates: true,
      });
  }

  /**
   * Creatives must be READY images uploaded with purpose BANNER_CREATIVE. `MediaService.assertOwnedReady`
   * is per-uploader and campaigns are shared assets, so ownership is deliberately not required here.
   */
  private async validateInput(input: UpsertCampaignInput): Promise<void> {
    const issues: Array<{ field: string; message: string }> = [];

    const mediaIds = [
      ...new Set(
        input.banners.flatMap((b) => [b.creative.imageMediaId.ar, b.creative.imageMediaId.en]),
      ),
    ];
    const media = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, kind: true, purpose: true, status: true },
    });
    const mediaById = new Map(media.map((m) => [m.id, m] as const));
    for (const mediaId of mediaIds) {
      const row = mediaById.get(mediaId);
      if (!row)
        issues.push({
          field: 'banners.creative.imageMediaId',
          message: `media ${mediaId} was not found`,
        });
      else if (row.purpose !== 'BANNER_CREATIVE')
        issues.push({
          field: 'banners.creative.imageMediaId',
          message: `media ${mediaId} must have purpose BANNER_CREATIVE`,
        });
      else if (row.kind !== 'IMAGE')
        issues.push({
          field: 'banners.creative.imageMediaId',
          message: `media ${mediaId} is not an image`,
        });
      else if (row.status !== 'READY')
        issues.push({
          field: 'banners.creative.imageMediaId',
          message: `media ${mediaId} is not READY`,
        });
    }

    const categoryIds = [
      ...new Set(
        input.banners
          .filter((b) => b.actionType === 'SERVICE_CATEGORY' && b.actionValue)
          .map((b) => b.actionValue as string),
      ),
    ];
    if (categoryIds.length) {
      const found = await this.prisma.serviceCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((c) => c.id));
      for (const categoryId of categoryIds) {
        if (!foundIds.has(categoryId))
          issues.push({
            field: 'banners.actionValue',
            message: `service category ${categoryId} was not found`,
          });
      }
    }

    if (input.targeting.zoneIds.length) {
      const zones = await this.prisma.serviceZone.findMany({
        where: { id: { in: input.targeting.zoneIds } },
        select: { id: true },
      });
      const zoneIds = new Set(zones.map((z) => z.id));
      for (const zoneId of input.targeting.zoneIds) {
        if (!zoneIds.has(zoneId))
          issues.push({ field: 'targeting.zoneIds', message: `zone ${zoneId} was not found` });
      }
    }

    const min = input.targeting.minCompletedJobs;
    const max = input.targeting.maxCompletedJobs;
    if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) {
      issues.push({
        field: 'targeting.maxCompletedJobs',
        message: 'maxCompletedJobs must be greater than or equal to minCompletedJobs',
      });
    }

    if (issues.length) throw AppException.validation(issues);
  }

  private async lifetimeStats(campaignIds: string[]): Promise<Map<string, CampaignStatsDto>> {
    const out = new Map<string, CampaignStatsDto>();
    if (!campaignIds.length) return out;
    const grouped = await this.prisma.bannerDailyStat.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _sum: {
        impressions: true,
        uniqueImpressions: true,
        clicks: true,
        dismissals: true,
        conversions: true,
      },
    });
    for (const row of grouped) {
      const impressions = row._sum.impressions ?? 0;
      const clicks = row._sum.clicks ?? 0;
      out.set(row.campaignId, {
        impressions,
        uniqueImpressions: row._sum.uniqueImpressions ?? 0,
        clicks,
        dismissals: row._sum.dismissals ?? 0,
        ctr: ratio(clicks, impressions),
        conversions: row._sum.conversions ?? 0,
        byPlacement: [],
        byDay: [],
      });
    }
    return out;
  }

  private toDto(
    row: CampaignWithRelations,
    stats: CampaignStatsDto,
    tokenExp: number,
  ): CampaignDto {
    const targeting: CampaignTargetingDto = {
      audiences: row.audiences,
      zoneIds: row.zones.map((z) => z.zoneId),
      languages: row.languages.filter((l): l is Language => l === 'ar' || l === 'en'),
      platforms: row.platforms.filter(
        (p): p is 'ios' | 'android' => p === 'ios' || p === 'android',
      ),
      newCustomersOnly: row.newCustomersOnly,
      minCompletedJobs: row.minCompletedJobs,
      maxCompletedJobs: row.maxCompletedJobs,
      serviceTypeInterest: row.serviceTypeInterest,
      rolloutPercent: row.rolloutPercent,
    };

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      targeting,
      frequencyCapPerDay: row.frequencyCapPerDay,
      banners: row.banners.map((b) => ({
        ...this.feed.toBannerDto(toCandidateBanner(b), row.id, ANONYMOUS_VIEWER_ID, tokenExp),
        isActive: b.isActive,
        sortOrder: b.sortOrder,
        // The ids the update payload speaks; the signed URLs beside them are for preview only.
        imageMediaId: { ar: b.imageArMediaId, en: b.imageEnMediaId },
      })),
      stats,
      createdBy: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }
}

/* --------------------------------------------------------------- helpers */

function bannerData(b: BannerInput) {
  return {
    placement: b.placement,
    headlineAr: b.creative.headline?.ar ?? null,
    headlineEn: b.creative.headline?.en ?? null,
    subheadlineAr: b.creative.subheadline?.ar ?? null,
    subheadlineEn: b.creative.subheadline?.en ?? null,
    ctaLabelAr: b.creative.ctaLabel?.ar ?? null,
    ctaLabelEn: b.creative.ctaLabel?.en ?? null,
    badgeAr: b.creative.badge?.ar ?? null,
    badgeEn: b.creative.badge?.en ?? null,
    imageArMediaId: b.creative.imageMediaId.ar,
    imageEnMediaId: b.creative.imageMediaId.en,
    theme: b.creative.theme,
    actionType: b.actionType,
    actionValue: b.actionValue ?? null,
    priority: b.priority,
    sortOrder: b.sortOrder,
    isActive: b.isActive,
  };
}

export function toCandidateBanner(row: CampaignBannerRow): CandidateBanner {
  return {
    id: row.id,
    placement: row.placement,
    headlineAr: row.headlineAr,
    headlineEn: row.headlineEn,
    subheadlineAr: row.subheadlineAr,
    subheadlineEn: row.subheadlineEn,
    ctaLabelAr: row.ctaLabelAr,
    ctaLabelEn: row.ctaLabelEn,
    badgeAr: row.badgeAr,
    badgeEn: row.badgeEn,
    imageAr: row.imageAr,
    imageEn: row.imageEn,
    theme: row.theme,
    actionType: row.actionType,
    actionValue: row.actionValue,
    priority: row.priority,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

const ratio = (numerator: number, denominator: number): number =>
  denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : 0;

const utcMidnight = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const emptyStats = (): CampaignStatsDto => ({
  impressions: 0,
  uniqueImpressions: 0,
  clicks: 0,
  dismissals: 0,
  ctr: 0,
  conversions: 0,
  byPlacement: [],
  byDay: [],
});
