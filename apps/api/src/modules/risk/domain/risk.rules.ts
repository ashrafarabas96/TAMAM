import { RiskSignal } from '@tamam/shared-types';

/**
 * Pure fraud/abuse rules (spec §86). They take already-measured counters and thresholds and
 * return the signals that fired — no Nest, no Prisma, no clock — so the whole matrix is unit-tested.
 */

/** A device seen on this many distinct accounts looks like account farming. */
export const MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD = 3;
/** Invitees signing up from the inviter's own device beyond this count is referral farming. */
export const UNUSUAL_REFERRAL_THRESHOLD = 5;

/** Score floor for a rule that fired; the score scales with how far past the threshold the value is. */
const MIN_SCORE = 50;
const MAX_SCORE = 100;

export interface RiskThresholds {
  maxCancellationsPerDay: number;
  maxFailedPaymentsPerDay: number;
  maxPromoRedemptionsPerDay: number;
  /** Speed above which a GPS jump is physically impossible for a road vehicle. */
  maxSpeedKmh: number;
}

export interface RiskCounters {
  cancellationsToday: number;
  failedPaymentsToday: number;
  promoRedemptionsToday: number;
  /** Highest implied speed between two consecutive samples, already computed by tracking. */
  maxObservedSpeedKmh: number | null;
  /** Distinct users that have signed in from the same device id. */
  accountsOnDevice: number;
  /** Invitees whose sessions share a device with the inviter. */
  referralsFromSameDevice: number;
}

export interface RiskFinding {
  signal: RiskSignal;
  /** 50..100 — 50 means "just over the line", 100 means "far past it". */
  score: number;
  details: Record<string, unknown>;
}

/** Linear score between MIN_SCORE (at the threshold) and MAX_SCORE (at twice the threshold). */
export function ratioScore(value: number, threshold: number): number {
  if (threshold <= 0) return MAX_SCORE;
  const scaled = Math.round((value / threshold) * MIN_SCORE);
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, scaled));
}

export function emptyCounters(): RiskCounters {
  return {
    cancellationsToday: 0,
    failedPaymentsToday: 0,
    promoRedemptionsToday: 0,
    maxObservedSpeedKmh: null,
    accountsOnDevice: 0,
    referralsFromSameDevice: 0,
  };
}

/** Runs every rule and returns the findings, highest score first. */
export function evaluateRiskRules(
  counters: RiskCounters,
  thresholds: RiskThresholds,
): RiskFinding[] {
  const findings: RiskFinding[] = [];

  if (counters.cancellationsToday > thresholds.maxCancellationsPerDay) {
    findings.push({
      signal: RiskSignal.EXCESSIVE_CANCELLATIONS,
      score: ratioScore(counters.cancellationsToday, thresholds.maxCancellationsPerDay),
      details: {
        cancellationsToday: counters.cancellationsToday,
        threshold: thresholds.maxCancellationsPerDay,
      },
    });
  }

  if (counters.failedPaymentsToday > thresholds.maxFailedPaymentsPerDay) {
    findings.push({
      signal: RiskSignal.REPEATED_FAILED_PAYMENTS,
      score: ratioScore(counters.failedPaymentsToday, thresholds.maxFailedPaymentsPerDay),
      details: {
        failedPaymentsToday: counters.failedPaymentsToday,
        threshold: thresholds.maxFailedPaymentsPerDay,
      },
    });
  }

  if (counters.promoRedemptionsToday > thresholds.maxPromoRedemptionsPerDay) {
    findings.push({
      signal: RiskSignal.PROMO_ABUSE,
      score: ratioScore(counters.promoRedemptionsToday, thresholds.maxPromoRedemptionsPerDay),
      details: {
        promoRedemptionsToday: counters.promoRedemptionsToday,
        threshold: thresholds.maxPromoRedemptionsPerDay,
      },
    });
  }

  if (
    counters.maxObservedSpeedKmh !== null &&
    counters.maxObservedSpeedKmh > thresholds.maxSpeedKmh
  ) {
    findings.push({
      signal: RiskSignal.IMPOSSIBLE_GPS_MOVEMENT,
      score: ratioScore(counters.maxObservedSpeedKmh, thresholds.maxSpeedKmh),
      details: {
        observedKmh: Math.round(counters.maxObservedSpeedKmh),
        threshold: thresholds.maxSpeedKmh,
      },
    });
  }

  if (counters.accountsOnDevice >= MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD) {
    findings.push({
      signal: RiskSignal.MULTIPLE_ACCOUNTS,
      score: ratioScore(counters.accountsOnDevice, MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD),
      details: {
        accountsOnDevice: counters.accountsOnDevice,
        threshold: MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD,
      },
    });
  }

  if (counters.referralsFromSameDevice >= UNUSUAL_REFERRAL_THRESHOLD) {
    findings.push({
      signal: RiskSignal.UNUSUAL_REFERRAL_BEHAVIOUR,
      score: ratioScore(counters.referralsFromSameDevice, UNUSUAL_REFERRAL_THRESHOLD),
      details: {
        referralsFromSameDevice: counters.referralsFromSameDevice,
        threshold: UNUSUAL_REFERRAL_THRESHOLD,
      },
    });
  }

  return findings.sort((a, b) => b.score - a.score);
}
