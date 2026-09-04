import { describe, expect, it } from 'vitest';

import { upsertCampaignSchema } from '@tamam/validation';
import { bannerPlacements } from '@tamam/ui-tokens';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const banner = (overrides: Record<string, unknown> = {}) => ({
  placement: 'HOME_HERO',
  creative: { imageMediaId: { ar: UUID_A, en: UUID_B }, theme: 'purple' },
  actionType: 'NONE',
  priority: 10,
  sortOrder: 0,
  isActive: true,
  ...overrides,
});

const campaign = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ramadan offer',
  startsAt: '2026-03-01T00:00:00.000Z',
  endsAt: '2026-03-30T00:00:00.000Z',
  targeting: {
    audiences: ['CUSTOMER'],
    zoneIds: [],
    languages: [],
    platforms: [],
    newCustomersOnly: false,
    serviceTypeInterest: [],
    rolloutPercent: 100,
  },
  banners: [banner()],
  ...overrides,
});

describe('campaign form schema', () => {
  it('accepts a minimal valid campaign and applies defaults', () => {
    const parsed = upsertCampaignSchema.parse(campaign());
    expect(parsed.banners[0]?.creative.theme).toBe('purple');
    expect(parsed.targeting.rolloutPercent).toBe(100);
  });

  it('rejects an end date before the start date', () => {
    const result = upsertCampaignSchema.safeParse(
      campaign({ startsAt: '2026-03-30T00:00:00.000Z', endsAt: '2026-03-01T00:00:00.000Z' }),
    );
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(['endsAt']);
  });

  it('requires at least one banner and caps the list at twelve', () => {
    expect(upsertCampaignSchema.safeParse(campaign({ banners: [] })).success).toBe(false);
    expect(
      upsertCampaignSchema.safeParse(
        campaign({ banners: Array.from({ length: 13 }, () => banner()) }),
      ).success,
    ).toBe(false);
  });

  it('requires an action value once an action type is set', () => {
    const result = upsertCampaignSchema.safeParse(
      campaign({ banners: [banner({ actionType: 'DEEP_LINK' })] }),
    );
    expect(result.success).toBe(false);
  });

  it('enforces the deep-link scheme and https external urls', () => {
    expect(
      upsertCampaignSchema.safeParse(
        campaign({
          banners: [banner({ actionType: 'DEEP_LINK', actionValue: 'https://tamam.app' })],
        }),
      ).success,
    ).toBe(false);
    expect(
      upsertCampaignSchema.safeParse(
        campaign({
          banners: [banner({ actionType: 'DEEP_LINK', actionValue: 'tamam://services/plumbing' })],
        }),
      ).success,
    ).toBe(true);
    expect(
      upsertCampaignSchema.safeParse(
        campaign({
          banners: [banner({ actionType: 'EXTERNAL_URL', actionValue: 'http://tamam.app' })],
        }),
      ).success,
    ).toBe(false);
    expect(
      upsertCampaignSchema.safeParse(
        campaign({
          banners: [banner({ actionType: 'EXTERNAL_URL', actionValue: 'https://tamam.app' })],
        }),
      ).success,
    ).toBe(true);
  });

  it('requires both language creatives as media ids', () => {
    expect(
      upsertCampaignSchema.safeParse(
        campaign({
          banners: [
            banner({ creative: { imageMediaId: { ar: UUID_A, en: '' }, theme: 'purple' } }),
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('keeps the rollout percentage inside 1..100', () => {
    const targeting = {
      audiences: ['CUSTOMER'],
      zoneIds: [],
      languages: [],
      platforms: [],
      newCustomersOnly: false,
      serviceTypeInterest: [],
      rolloutPercent: 0,
    };
    expect(upsertCampaignSchema.safeParse(campaign({ targeting })).success).toBe(false);
  });

  it('exposes an aspect ratio for every placement the form offers', () => {
    for (const placement of Object.keys(bannerPlacements)) {
      const spec = bannerPlacements[placement as keyof typeof bannerPlacements];
      expect(spec.aspectRatio).toBeGreaterThan(1);
      expect(spec.maxItems).toBeGreaterThan(0);
    }
  });
});
