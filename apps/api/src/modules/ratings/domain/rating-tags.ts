import { ErrorCode } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';

/**
 * Pure rating rules (spec §59). No Nest, no Prisma — the tag whitelists, the edit window and the
 * profile aggregate maths live here so they can be unit-tested without a database.
 */

export const RatingDirection = {
  CUSTOMER_TO_PARTNER: 'CUSTOMER_TO_PARTNER',
  PARTNER_TO_CUSTOMER: 'PARTNER_TO_CUSTOMER',
} as const;
export type RatingDirection = (typeof RatingDirection)[keyof typeof RatingDirection];

/** What a customer may say about a partner. Clients translate these keys; they are never prose. */
export const CUSTOMER_TO_PARTNER_TAGS = [
  'PUNCTUAL',
  'POLITE',
  'CLEAN_VEHICLE',
  'SAFE_DRIVING',
  'PROFESSIONAL',
  'GOOD_COMMUNICATION',
  'FAIR_PRICE',
  'LATE',
  'RUDE',
  'UNSAFE',
] as const;

/** What a partner may say about a customer. */
export const PARTNER_TO_CUSTOMER_TAGS = ['POLITE', 'ON_TIME', 'CLEAR_INSTRUCTIONS', 'LATE', 'RUDE', 'WRONG_ADDRESS'] as const;

export const RATING_TAGS: Record<RatingDirection, readonly string[]> = {
  [RatingDirection.CUSTOMER_TO_PARTNER]: CUSTOMER_TO_PARTNER_TAGS,
  [RatingDirection.PARTNER_TO_CUSTOMER]: PARTNER_TO_CUSTOMER_TAGS,
};

/** Rating shown for a user who has never been rated (spec §59: new accounts start neutral-high). */
export const NEUTRAL_RATING = 5;

/** Deduplicates and validates the submitted tags against the whitelist for this direction. */
export function normaliseTags(direction: RatingDirection, tags: readonly string[]): string[] {
  const allowed = RATING_TAGS[direction];
  const unique = [...new Set(tags.map((tag) => tag.trim().toUpperCase()))].filter((tag) => tag.length > 0);
  const unknown = unique.filter((tag) => !allowed.includes(tag));
  if (unknown.length) {
    throw AppException.validation(
      unknown.map((tag) => ({ field: 'tags', message: `${tag} is not a valid tag for ${direction}` })),
      'Unknown rating tag',
    );
  }
  return unique;
}

export interface RatingAggregateDelta {
  sumDelta: number;
  countDelta: number;
}

/**
 * How a submission moves the ratee's cached `ratingSum` / `ratingCount`. An edit replaces the
 * previous score (sum moves by the difference, the count stays); a first rating adds both.
 */
export function aggregateDelta(previousRating: number | null, nextRating: number): RatingAggregateDelta {
  if (previousRating === null) return { sumDelta: nextRating, countDelta: 1 };
  return { sumDelta: nextRating - previousRating, countDelta: 0 };
}

/** Cached-aggregate average, rounded the same way everywhere in the platform. */
export function averageOf(sum: number, count: number): number {
  if (count <= 0) return NEUTRAL_RATING;
  return Number((sum / count).toFixed(2));
}

export function editableUntilFrom(now: Date, windowHours: number): Date {
  return new Date(now.getTime() + Math.max(0, windowHours) * 3600 * 1000);
}

export function isEditable(editableUntil: Date, now: Date): boolean {
  return editableUntil.getTime() > now.getTime();
}

export function assertEditable(editableUntil: Date, now: Date): void {
  if (!isEditable(editableUntil, now)) {
    throw AppException.conflict('The rating edit window has closed', ErrorCode.RATING_NOT_ALLOWED, {
      editableUntil: editableUntil.toISOString(),
    });
  }
}
