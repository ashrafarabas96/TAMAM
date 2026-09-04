import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { BannerPlacement } from '@tamam/shared-types';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

import { attributionKey } from './banner-events.service';

interface JobCreatedEventLike {
  jobId: string;
  customerId?: string;
}

interface RawEventAggregate {
  banner_id: string;
  campaign_id: string;
  placement: string;
  impressions: number;
  unique_impressions: number;
  clicks: number;
  dismissals: number;
}

interface ConversionAggregate {
  campaign_id: string;
  conversions: number;
}

export interface BannerRollupResult {
  date: string;
  rowsWritten: number;
  conversions: number;
}

/**
 * Conversion attribution and the nightly roll-up of raw banner events into `banner_daily_stats`
 * (spec §82). Dashboards read the aggregates only — they never scan the raw event table.
 */
@Injectable()
export class BannerAttributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {}

  /* --------------------------------------------------------- attribution */

  /**
   * Stamps a newly created job with the campaign the customer last clicked, when that click is
   * still inside `banners.attribution_window_h` (the Redis key's TTL enforces the window).
   * Only the first campaign wins: `attributedCampaignId` is written once and never overwritten.
   */
  @OnEvent('job.created')
  async handleJobCreated(event: JobCreatedEventLike): Promise<void> {
    try {
      const customerId =
        event.customerId ??
        (
          await this.prisma.job.findUnique({
            where: { id: event.jobId },
            select: { customerId: true },
          })
        )?.customerId;
      if (!customerId) return;
      await this.attribute(event.jobId, customerId);
    } catch (err) {
      // Attribution is analytics, never a reason to fail job creation.
      this.logger.error({ err, jobId: event.jobId }, 'banner attribution failed');
    }
  }

  /** Returns the campaign id the job was attributed to, or null. */
  async attribute(jobId: string, customerId: string): Promise<string | null> {
    const key = attributionKey(customerId);
    const campaignId = await this.redis.client.get(key);
    if (!campaignId) return null;

    const updated = await this.prisma.job.updateMany({
      where: { id: jobId, attributedCampaignId: null },
      data: { attributedCampaignId: campaignId },
    });
    await this.redis.del(key);
    return updated.count > 0 ? campaignId : null;
  }

  /* ------------------------------------------------------------ roll-up */

  /**
   * Aggregates one UTC day of `banner_events` into `banner_daily_stats`. Idempotent — re-running
   * a day overwrites its rows, so the maintenance queue may retry freely.
   *
   * Conversions are attributed at the *campaign* level (a job carries `attributedCampaignId`, not a
   * banner id, because the click that produced it may have happened on a different day). For the
   * per-banner table they are therefore assigned to a single representative banner of that campaign:
   * the highest-priority banner that recorded a click that day (ties broken by sortOrder then id),
   * falling back to the campaign's highest-priority banner when no banner was clicked. Campaign
   * totals are consequently exact; per-banner conversion splits are indicative.
   */
  async rollupDaily(date: Date): Promise<BannerRollupResult> {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    const dateOnly = new Date(start);

    const events = await this.prisma.$queryRaw<RawEventAggregate[]>`
      SELECT banner_id,
             campaign_id,
             placement::text AS placement,
             COUNT(*) FILTER (WHERE type = 'IMPRESSION')::int AS impressions,
             COUNT(DISTINCT CASE WHEN type = 'IMPRESSION' THEN COALESCE(user_id::text, session_id) END)::int AS unique_impressions,
             COUNT(*) FILTER (WHERE type = 'CLICK')::int AS clicks,
             COUNT(*) FILTER (WHERE type = 'DISMISS')::int AS dismissals
      FROM banner_events
      WHERE occurred_at >= ${start} AND occurred_at < ${end}
      GROUP BY 1, 2, 3`;

    const conversionRows = await this.prisma.$queryRaw<ConversionAggregate[]>`
      SELECT attributed_campaign_id::text AS campaign_id, COUNT(*)::int AS conversions
      FROM jobs
      WHERE attributed_campaign_id IS NOT NULL AND created_at >= ${start} AND created_at < ${end}
      GROUP BY 1`;

    const conversionsByCampaign = new Map<string, number>(
      conversionRows.map((r) => [r.campaign_id, Number(r.conversions)]),
    );
    const campaignIds = [
      ...new Set([...events.map((e) => e.campaign_id), ...conversionsByCampaign.keys()]),
    ];
    if (!campaignIds.length) return { date: isoDate(start), rowsWritten: 0, conversions: 0 };

    const banners = await this.prisma.banner.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { id: true, campaignId: true, placement: true, priority: true, sortOrder: true },
      orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    const clickedBanners = new Set(
      events.filter((e) => Number(e.clicks) > 0).map((e) => e.banner_id),
    );
    const conversionBannerByCampaign = new Map<
      string,
      { id: string; placement: BannerPlacement }
    >();
    for (const campaignId of conversionsByCampaign.keys()) {
      const owned = banners.filter((b) => b.campaignId === campaignId);
      const target = owned.find((b) => clickedBanners.has(b.id)) ?? owned[0];
      if (target)
        conversionBannerByCampaign.set(campaignId, { id: target.id, placement: target.placement });
    }

    const placementByBanner = new Map<string, BannerPlacement>(
      banners.map((b) => [b.id, b.placement]),
    );
    type StatRow = {
      bannerId: string;
      campaignId: string;
      placement: BannerPlacement;
      impressions: number;
      uniqueImpressions: number;
      clicks: number;
      dismissals: number;
      conversions: number;
    };
    const rows = new Map<string, StatRow>();

    for (const e of events) {
      const placement = (placementByBanner.get(e.banner_id) ?? e.placement) as BannerPlacement;
      rows.set(e.banner_id, {
        bannerId: e.banner_id,
        campaignId: e.campaign_id,
        placement,
        impressions: Number(e.impressions),
        uniqueImpressions: Number(e.unique_impressions),
        clicks: Number(e.clicks),
        dismissals: Number(e.dismissals),
        conversions: 0,
      });
    }

    let conversionTotal = 0;
    for (const [campaignId, count] of conversionsByCampaign) {
      const target = conversionBannerByCampaign.get(campaignId);
      if (!target) continue;
      conversionTotal += count;
      const existing = rows.get(target.id);
      if (existing) existing.conversions = count;
      else {
        rows.set(target.id, {
          bannerId: target.id,
          campaignId,
          placement: target.placement,
          impressions: 0,
          uniqueImpressions: 0,
          clicks: 0,
          dismissals: 0,
          conversions: count,
        });
      }
    }

    for (const row of rows.values()) {
      await this.prisma.bannerDailyStat.upsert({
        where: { bannerId_date: { bannerId: row.bannerId, date: dateOnly } },
        create: { ...row, date: dateOnly },
        update: {
          campaignId: row.campaignId,
          placement: row.placement,
          impressions: row.impressions,
          uniqueImpressions: row.uniqueImpressions,
          clicks: row.clicks,
          dismissals: row.dismissals,
          conversions: row.conversions,
        },
      });
    }

    return { date: isoDate(start), rowsWritten: rows.size, conversions: conversionTotal };
  }
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
