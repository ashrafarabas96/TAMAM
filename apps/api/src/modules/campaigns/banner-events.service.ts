import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import { type BannerEventType, CONFIG_KEYS } from '@tamam/shared-types';
import type { BannerEventBatchInput } from '@tamam/validation';
import { Logger } from 'nestjs-pino';

import type { RequestUser } from '../../common/types/request-user';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemConfigService } from '../config/system-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { frequencyKey, secondsUntilNextUtcDay, utcDayKey } from './banner-feed.service';
import { ANONYMOUS_VIEWER_ID } from './domain/banner-targeting';
import { verifyBannerToken } from './domain/banner-token';

/** Redis key holding the campaign a user last clicked, used for conversion attribution. */
export const attributionKey = (userId: string): string => `banners:attr:${userId}`;

/** `dedupe_key` is a VarChar(200); session ids are up to 128 chars so the parts are bounded. */
const MAX_DEDUPE_KEY = 200;

export interface BannerEventIngestResult {
  accepted: number;
  rejected: number;
}

export type BannerEventPlatform = 'ios' | 'android' | 'web' | null;

/**
 * Ingests batched banner impressions/clicks/dismissals from the apps (spec §82).
 *
 * Every event must carry the HMAC tracking token issued with the feed — the banner id, campaign id
 * and subject come from the token, never from the request body, so a client cannot inflate another
 * campaign's numbers. Events are deduped in the database on `(banner, viewer, type, minute)`.
 */
@Injectable()
export class BannerEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly systemConfig: SystemConfigService,
    private readonly metrics: MetricsService,
    private readonly events: EventEmitter2,
    private readonly config: AppConfigService,
    private readonly logger: Logger,
  ) {}

  /**
   * `accepted` is the number of rows actually written; `rejected` covers everything else —
   * invalid or expired tokens, tokens belonging to another user, and events already recorded
   * for the same (banner, viewer, type, minute).
   */
  async ingest(user: RequestUser | null, batch: BannerEventBatchInput, platform: BannerEventPlatform): Promise<BannerEventIngestResult> {
    const now = new Date();
    const pepper = this.config.env.OTP_PEPPER;
    const attributionWindowH = await this.systemConfig.getNumber(CONFIG_KEYS.BANNER_ATTRIBUTION_WINDOW_H);

    const rows: Prisma.BannerEventCreateManyInput[] = [];
    const seen = new Set<string>();
    const clicks: Array<{ campaignId: string; bannerId: string }> = [];
    const impressions: Array<{ campaignId: string }> = [];

    for (const event of batch.events) {
      const payload = verifyBannerToken(event.trackingToken, pepper, now);
      if (!payload) {
        this.logger.warn({ placement: event.placement, type: event.type }, 'banner event rejected: invalid or expired tracking token');
        continue;
      }
      // A token issued for one user may never be replayed by another.
      if (user && payload.subject !== ANONYMOUS_VIEWER_ID && payload.subject !== user.id) {
        this.logger.warn({ bannerId: payload.bannerId, userId: user.id }, 'banner event rejected: tracking token belongs to another user');
        continue;
      }

      const viewerKeyPart = user?.id ?? event.sessionId;
      const occurredAt = new Date(event.occurredAt);
      const dedupeKey = buildDedupeKey(payload.bannerId, viewerKeyPart, event.type, occurredAt);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      rows.push({
        bannerId: payload.bannerId,
        campaignId: payload.campaignId,
        userId: user?.id ?? null,
        sessionId: event.sessionId,
        type: event.type,
        placement: event.placement,
        platform,
        zoneId: null,
        dedupeKey,
        occurredAt,
      });

      if (event.type === 'CLICK') clicks.push({ campaignId: payload.campaignId, bannerId: payload.bannerId });
      if (event.type === 'IMPRESSION') impressions.push({ campaignId: payload.campaignId });
    }

    if (!rows.length) return { accepted: 0, rejected: batch.events.length };

    const created = await this.prisma.bannerEvent.createMany({ data: rows, skipDuplicates: true });
    for (const row of rows) this.metrics.bannerEvents.inc({ type: row.type, placement: row.placement });

    if (user) {
      if (created.count === rows.length) {
        await this.bumpFrequencyCounters(user.id, impressions, now);
      } else {
        // A retried batch was partly deduped: incrementing would over-count, so drop the cached
        // counters and let the feed rebuild them from banner_events on the next read.
        await this.resetFrequencyCounters(user.id, impressions, now);
      }
      await this.recordClickAttribution(user.id, clicks, attributionWindowH);
    }

    for (const click of clicks) {
      this.events.emit('banner.clicked', { userId: user?.id ?? null, campaignId: click.campaignId, bannerId: click.bannerId });
    }

    return { accepted: created.count, rejected: batch.events.length - created.count };
  }

  /**
   * Keeps the per-user/per-campaign impression counters the feed reads when enforcing
   * `frequencyCapPerDay`. Buckets are UTC days and expire at the next UTC midnight.
   */
  private async bumpFrequencyCounters(userId: string, impressions: Array<{ campaignId: string }>, now: Date): Promise<void> {
    if (!impressions.length) return;
    const day = utcDayKey(now);
    const ttl = secondsUntilNextUtcDay(now);
    const perCampaign = new Map<string, number>();
    for (const i of impressions) perCampaign.set(i.campaignId, (perCampaign.get(i.campaignId) ?? 0) + 1);

    const pipeline = this.redis.client.pipeline();
    for (const [campaignId, count] of perCampaign) {
      const key = frequencyKey(userId, campaignId, day);
      pipeline.incrby(key, count);
      pipeline.expire(key, ttl);
    }
    await pipeline.exec();
  }

  /** Drops the cached counters so the next feed read recomputes them from `banner_events`. */
  private async resetFrequencyCounters(userId: string, impressions: Array<{ campaignId: string }>, now: Date): Promise<void> {
    if (!impressions.length) return;
    const day = utcDayKey(now);
    const keys = [...new Set(impressions.map((i) => i.campaignId))].map((campaignId) => frequencyKey(userId, campaignId, day));
    await this.redis.del(...keys);
  }

  /**
   * Remembers the last campaign a user clicked so `BannerAttributionService` can stamp the next
   * job they create. The key expires after `banners.attribution_window_h`.
   */
  private async recordClickAttribution(userId: string, clicks: Array<{ campaignId: string }>, windowHours: number): Promise<void> {
    const last = clicks[clicks.length - 1];
    if (!last) return;
    await this.redis.client.set(attributionKey(userId), last.campaignId, 'EX', Math.max(1, Math.round(windowHours * 3600)));
  }
}

/** `<bannerId>:<userId|sessionId>:<type>:<yyyymmddhhmm>` — one event per viewer, per type, per minute. */
export function buildDedupeKey(bannerId: string, viewerKey: string, type: BannerEventType, occurredAt: Date): string {
  const minute = [
    occurredAt.getUTCFullYear(),
    String(occurredAt.getUTCMonth() + 1).padStart(2, '0'),
    String(occurredAt.getUTCDate()).padStart(2, '0'),
    String(occurredAt.getUTCHours()).padStart(2, '0'),
    String(occurredAt.getUTCMinutes()).padStart(2, '0'),
  ].join('');
  return `${bannerId}:${viewerKey}:${type}:${minute}`.slice(0, MAX_DEDUPE_KEY);
}
