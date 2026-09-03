/**
 * Candidate scoring (spec §20). Pure, deterministic, unit-tested.
 * Every component is normalised to 0..1 (higher = better) then weighted; rating alone can never
 * dominate because its weight is capped by admin configuration.
 */
export interface CandidateInput {
  partnerId: string;
  distanceMeters: number;
  etaSeconds: number;
  rating: number; // 1..5, default 5 when unrated
  ratingCount: number;
  acceptanceRate: number; // 0..1
  cancellationRate: number; // 0..1
  /** Jobs completed in the last hour (fatigue / workload proxy). */
  recentJobs: number;
  penaltyPoints: number;
}

export interface ScoringWeights {
  eta: number;
  distance: number;
  rating: number;
  acceptance: number;
  cancellation: number;
  workload: number;
}

export interface ScoredCandidate extends CandidateInput {
  score: number;
}

export function scoreCandidates(candidates: CandidateInput[], w: ScoringWeights, maxRadiusMeters: number): ScoredCandidate[] {
  if (!candidates.length) return [];
  const maxEta = Math.max(60, ...candidates.map((c) => c.etaSeconds));
  const total = w.eta + w.distance + w.rating + w.acceptance + w.cancellation + w.workload || 1;
  return candidates
    .map((c) => {
      const etaScore = 1 - Math.min(c.etaSeconds, maxEta) / maxEta;
      const distanceScore = 1 - Math.min(c.distanceMeters, maxRadiusMeters) / maxRadiusMeters;
      // Bayesian-smoothed rating so a single 5★ review doesn't outrank a 4.8★ veteran.
      const smoothedRating = (c.rating * c.ratingCount + 4.5 * 5) / (c.ratingCount + 5);
      const ratingScore = Math.max(0, (smoothedRating - 1) / 4);
      const acceptanceScore = Math.max(0, Math.min(1, c.acceptanceRate));
      const cancellationScore = 1 - Math.max(0, Math.min(1, c.cancellationRate));
      const workloadScore = 1 - Math.min(c.recentJobs, 5) / 5;
      const penalty = Math.min(c.penaltyPoints, 10) * 0.02;
      const score = (w.eta * etaScore + w.distance * distanceScore + w.rating * ratingScore + w.acceptance * acceptanceScore + w.cancellation * cancellationScore + w.workload * workloadScore) / total - penalty;
      return { ...c, score: Number(Math.max(0, score).toFixed(4)) };
    })
    .sort((a, b) => b.score - a.score || a.etaSeconds - b.etaSeconds);
}
