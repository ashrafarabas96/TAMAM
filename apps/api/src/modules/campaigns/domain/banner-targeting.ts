import { BannerAudience, CampaignStatus, type JobType } from '@tamam/shared-types';

/**
 * Pure targeting rules for promotional banners (spec §80–§82).
 *
 * Everything in this file is deterministic and free of Nest/Prisma so the rules can be
 * unit-tested and re-run identically on a cached candidate list.
 */

/** Subject used for rollout bucketing when the viewer is not signed in. */
export const ANONYMOUS_VIEWER_ID = 'anon';

/** The subset of a campaign the targeting rules need. Dates are real `Date`s. */
export interface TargetableCampaign {
  id: string;
  status: CampaignStatus;
  startsAt: Date;
  endsAt: Date | null;
  /** Empty is treated as "every audience" even though the API requires at least one. */
  audiences: BannerAudience[];
  /** Empty = all zones. */
  zoneIds: string[];
  /** Empty = all languages. */
  languages: string[];
  /** Empty = all platforms. */
  platforms: string[];
  newCustomersOnly: boolean;
  minCompletedJobs: number | null;
  maxCompletedJobs: number | null;
  /** Empty = no interest filter; otherwise the viewer must have used one of these services. */
  serviceTypeInterest: JobType[];
  /** 1..100 — deterministic per (campaign, viewer). */
  rolloutPercent: number;
}

/** Everything known about the person the feed is being built for. */
export interface BannerViewer {
  /** User id, or {@link ANONYMOUS_VIEWER_ID} for signed-out viewers. */
  userId: string;
  audience: 'CUSTOMER' | 'PARTNER';
  zoneId: string | null;
  language: 'ar' | 'en';
  platform?: 'ios' | 'android' | 'web';
  completedJobs: number;
  isNewCustomer: boolean;
  usedJobTypes: JobType[];
}

/**
 * Deterministic 0..99 bucket for percentage rollouts. Uses the same FNV-1a hash as
 * `SystemConfigService` so a user lands in comparable buckets across both systems.
 */
export function rolloutBucket(campaignId: string, userId: string): number {
  const input = `${campaignId}:${userId}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

/** A campaign is live when it is ACTIVE and `now` falls inside its schedule. */
export function isLiveAt(campaign: Pick<TargetableCampaign, 'status' | 'startsAt' | 'endsAt'>, now: Date): boolean {
  if (campaign.status !== CampaignStatus.ACTIVE) return false;
  if (campaign.startsAt.getTime() > now.getTime()) return false;
  if (campaign.endsAt && campaign.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * True when every targeting rule of the campaign accepts this viewer. Rules are ANDed;
 * an empty list always means "no restriction on this dimension".
 */
export function matchesTargeting(campaign: TargetableCampaign, viewer: BannerViewer): boolean {
  if (campaign.audiences.length && !campaign.audiences.includes(viewer.audience as BannerAudience)) return false;

  if (campaign.zoneIds.length) {
    if (!viewer.zoneId || !campaign.zoneIds.includes(viewer.zoneId)) return false;
  }

  if (campaign.languages.length && !campaign.languages.includes(viewer.language)) return false;

  if (campaign.platforms.length) {
    if (!viewer.platform || !campaign.platforms.includes(viewer.platform)) return false;
  }

  if (campaign.newCustomersOnly && !viewer.isNewCustomer) return false;

  if (campaign.minCompletedJobs !== null && viewer.completedJobs < campaign.minCompletedJobs) return false;
  if (campaign.maxCompletedJobs !== null && viewer.completedJobs > campaign.maxCompletedJobs) return false;

  if (campaign.serviceTypeInterest.length) {
    const used = new Set<JobType>(viewer.usedJobTypes);
    if (!campaign.serviceTypeInterest.some((t) => used.has(t))) return false;
  }

  if (campaign.rolloutPercent < 100) {
    if (rolloutBucket(campaign.id, viewer.userId) >= campaign.rolloutPercent) return false;
  }

  return true;
}

/** Feed ordering: highest priority first, then the admin-defined sort order, then a stable id tiebreak. */
export function compareBannerOrder(
  a: { priority: number; sortOrder: number; id: string },
  b: { priority: number; sortOrder: number; id: string },
): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
