import type { BannerActionType, BannerAudience, BannerPlacement, CampaignStatus, JobType } from '@tamam/shared-types';

/**
 * Shapes shared by the feed, the events pipeline and the admin service. They are cached in
 * Redis, so every field must survive a JSON round-trip — timestamps are ISO strings and are
 * revived into `Date`s before the pure targeting rules see them.
 */

/**
 * Per-placement maximum number of banners the API returns.
 *
 * MIRRORS `packages/ui-tokens/tokens.json` → `banner.placements[*].maxItems`. Kept as a const
 * (instead of requiring the JSON across the workspace boundary) so the API build never depends
 * on a relative path into another package. Update both together.
 */
export const PLACEMENT_LIMITS: Record<BannerPlacement, number> = {
  HOME_HERO: 6,
  HOME_INLINE: 3,
  SERVICE_CATEGORY_TOP: 3,
  CHECKOUT_PROMO: 1,
  ORDER_TRACKING: 1,
  PARTNER_HOME: 3,
};

/**
 * Minimum media columns `MediaUrlService.urlFor` needs.
 *
 * (The `theme` string on a banner is one of `banner.themes` in ui-tokens/tokens.json; the set is
 * enforced by `bannerCreativeSchema` in @tamam/validation, so it is not duplicated here.)
 */
export interface BannerMediaRef {
  bucket: string;
  objectKey: string;
  isPublic: boolean;
  mediumKey: string | null;
  thumbnailKey: string | null;
}

export interface CandidateBanner {
  id: string;
  placement: BannerPlacement;
  headlineAr: string | null;
  headlineEn: string | null;
  subheadlineAr: string | null;
  subheadlineEn: string | null;
  ctaLabelAr: string | null;
  ctaLabelEn: string | null;
  badgeAr: string | null;
  badgeEn: string | null;
  imageAr: BannerMediaRef;
  imageEn: BannerMediaRef;
  theme: string;
  actionType: BannerActionType;
  actionValue: string | null;
  priority: number;
  sortOrder: number;
  isActive: boolean;
}

/** A campaign plus the banners of one placement, in the JSON-safe form kept in Redis. */
export interface CandidateCampaign {
  id: string;
  status: CampaignStatus;
  /** ISO-8601 UTC. */
  startsAt: string;
  /** ISO-8601 UTC or null. */
  endsAt: string | null;
  audiences: BannerAudience[];
  zoneIds: string[];
  languages: string[];
  platforms: string[];
  newCustomersOnly: boolean;
  minCompletedJobs: number | null;
  maxCompletedJobs: number | null;
  serviceTypeInterest: JobType[];
  rolloutPercent: number;
  frequencyCapPerDay: number | null;
  banners: CandidateBanner[];
}

/** Prisma `select` for the media columns a creative needs. */
export const bannerMediaSelect = {
  bucket: true,
  objectKey: true,
  isPublic: true,
  mediumKey: true,
  thumbnailKey: true,
} as const;
