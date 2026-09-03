import { scoreCandidates } from './candidate-scoring';

const w = { eta: 0.35, distance: 0.2, rating: 0.15, acceptance: 0.15, cancellation: 0.1, workload: 0.05 };
const base = { rating: 4.8, ratingCount: 50, acceptanceRate: 0.9, cancellationRate: 0.05, recentJobs: 0, penaltyPoints: 0 };

describe('scoreCandidates', () => {
  it('prefers the closer partner when everything else is equal', () => {
    const r = scoreCandidates([{ partnerId: 'far', distanceMeters: 4000, etaSeconds: 600, ...base }, { partnerId: 'near', distanceMeters: 500, etaSeconds: 90, ...base }], w, 5000);
    expect(r[0]?.partnerId).toBe('near');
  });
  it('rating alone cannot beat a much closer partner (spec §20)', () => {
    const r = scoreCandidates([{ partnerId: 'star', distanceMeters: 4500, etaSeconds: 700, ...base, rating: 5, ratingCount: 200 }, { partnerId: 'near', distanceMeters: 400, etaSeconds: 80, ...base, rating: 4.2 }], w, 5000);
    expect(r[0]?.partnerId).toBe('near');
  });
  it('penalises high cancellation and penalty points', () => {
    const r = scoreCandidates([{ partnerId: 'flaky', distanceMeters: 1000, etaSeconds: 200, ...base, cancellationRate: 0.5, penaltyPoints: 5 }, { partnerId: 'steady', distanceMeters: 1000, etaSeconds: 200, ...base }], w, 5000);
    expect(r[0]?.partnerId).toBe('steady');
  });
  it('returns empty for no candidates', () => {
    expect(scoreCandidates([], w, 5000)).toEqual([]);
  });
});
