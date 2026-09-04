import { RiskSignal } from '@tamam/shared-types';

import {
  MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD,
  type RiskCounters,
  type RiskThresholds,
  UNUSUAL_REFERRAL_THRESHOLD,
  emptyCounters,
  evaluateRiskRules,
  ratioScore,
} from './risk.rules';

const thresholds: RiskThresholds = {
  maxCancellationsPerDay: 5,
  maxFailedPaymentsPerDay: 5,
  maxPromoRedemptionsPerDay: 3,
  maxSpeedKmh: 180,
};

function counters(overrides: Partial<RiskCounters> = {}): RiskCounters {
  return { ...emptyCounters(), ...overrides };
}

const signals = (c: RiskCounters): RiskSignal[] =>
  evaluateRiskRules(c, thresholds).map((f) => f.signal);

describe('ratioScore', () => {
  it('returns the floor exactly at the threshold', () => {
    expect(ratioScore(5, 5)).toBe(50);
  });

  it('scales linearly and caps at 100', () => {
    expect(ratioScore(10, 5)).toBe(100);
    expect(ratioScore(50, 5)).toBe(100);
    expect(ratioScore(7, 5)).toBe(70);
  });

  it('never drops below the floor', () => {
    expect(ratioScore(1, 5)).toBe(50);
  });

  it('treats a zero threshold as maximum risk', () => {
    expect(ratioScore(1, 0)).toBe(100);
  });
});

describe('evaluateRiskRules', () => {
  it('returns nothing for a clean user', () => {
    expect(evaluateRiskRules(counters(), thresholds)).toEqual([]);
  });

  /* ------------------------------------------------------- cancellations */
  it('does not fire at the cancellation threshold', () => {
    expect(signals(counters({ cancellationsToday: 5 }))).toEqual([]);
  });

  it('fires EXCESSIVE_CANCELLATIONS above the threshold', () => {
    const findings = evaluateRiskRules(counters({ cancellationsToday: 6 }), thresholds);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.signal).toBe(RiskSignal.EXCESSIVE_CANCELLATIONS);
    expect(findings[0]?.details).toEqual({ cancellationsToday: 6, threshold: 5 });
  });

  /* ------------------------------------------------------ failed payments */
  it('fires REPEATED_FAILED_PAYMENTS above the threshold', () => {
    expect(signals(counters({ failedPaymentsToday: 6 }))).toEqual([
      RiskSignal.REPEATED_FAILED_PAYMENTS,
    ]);
    expect(signals(counters({ failedPaymentsToday: 5 }))).toEqual([]);
  });

  /* --------------------------------------------------------- promo abuse */
  it('fires PROMO_ABUSE above the redemption threshold', () => {
    expect(signals(counters({ promoRedemptionsToday: 4 }))).toEqual([RiskSignal.PROMO_ABUSE]);
    expect(signals(counters({ promoRedemptionsToday: 3 }))).toEqual([]);
  });

  /* ----------------------------------------------------------------- GPS */
  it('fires IMPOSSIBLE_GPS_MOVEMENT above the max speed', () => {
    const findings = evaluateRiskRules(counters({ maxObservedSpeedKmh: 420.4 }), thresholds);
    expect(findings[0]?.signal).toBe(RiskSignal.IMPOSSIBLE_GPS_MOVEMENT);
    expect(findings[0]?.details).toEqual({ observedKmh: 420, threshold: 180 });
  });

  it('ignores a plausible speed and an unknown speed', () => {
    expect(signals(counters({ maxObservedSpeedKmh: 180 }))).toEqual([]);
    expect(signals(counters({ maxObservedSpeedKmh: null }))).toEqual([]);
  });

  /* --------------------------------------------------- multiple accounts */
  it('fires MULTIPLE_ACCOUNTS at the device threshold (inclusive)', () => {
    expect(signals(counters({ accountsOnDevice: MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD }))).toEqual([
      RiskSignal.MULTIPLE_ACCOUNTS,
    ]);
    expect(signals(counters({ accountsOnDevice: MULTIPLE_ACCOUNTS_DEVICE_THRESHOLD - 1 }))).toEqual(
      [],
    );
  });

  /* --------------------------------------------------------- referrals */
  it('fires UNUSUAL_REFERRAL_BEHAVIOUR at the referral threshold (inclusive)', () => {
    expect(signals(counters({ referralsFromSameDevice: UNUSUAL_REFERRAL_THRESHOLD }))).toEqual([
      RiskSignal.UNUSUAL_REFERRAL_BEHAVIOUR,
    ]);
    expect(signals(counters({ referralsFromSameDevice: UNUSUAL_REFERRAL_THRESHOLD - 1 }))).toEqual(
      [],
    );
  });

  /* ---------------------------------------------------------- combining */
  it('reports every rule that fired, highest score first', () => {
    const findings = evaluateRiskRules(
      counters({ cancellationsToday: 6, promoRedemptionsToday: 12, maxObservedSpeedKmh: 200 }),
      thresholds,
    );
    expect(findings.map((f) => f.signal)).toEqual([
      RiskSignal.PROMO_ABUSE,
      RiskSignal.EXCESSIVE_CANCELLATIONS,
      RiskSignal.IMPOSSIBLE_GPS_MOVEMENT,
    ]);
    const scores = findings.map((f) => f.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('keeps every score inside 50..100', () => {
    const findings = evaluateRiskRules(
      counters({
        cancellationsToday: 500,
        failedPaymentsToday: 6,
        promoRedemptionsToday: 4,
        maxObservedSpeedKmh: 190,
        accountsOnDevice: 9,
        referralsFromSameDevice: 5,
      }),
      thresholds,
    );
    expect(findings).toHaveLength(6);
    for (const finding of findings) {
      expect(finding.score).toBeGreaterThanOrEqual(50);
      expect(finding.score).toBeLessThanOrEqual(100);
    }
  });
});
