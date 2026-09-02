import { BannerAudience, CampaignStatus, JobType } from '@tamam/shared-types';

import {
  ANONYMOUS_VIEWER_ID,
  type BannerViewer,
  type TargetableCampaign,
  compareBannerOrder,
  isLiveAt,
  matchesTargeting,
  rolloutBucket,
} from './banner-targeting';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ZONE_A = '33333333-3333-4333-8333-333333333333';
const ZONE_B = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-03-15T10:00:00.000Z');

function campaign(overrides: Partial<TargetableCampaign> = {}): TargetableCampaign {
  return {
    id: CAMPAIGN_ID,
    status: CampaignStatus.ACTIVE,
    startsAt: new Date('2026-03-01T00:00:00.000Z'),
    endsAt: null,
    audiences: [BannerAudience.CUSTOMER],
    zoneIds: [],
    languages: [],
    platforms: [],
    newCustomersOnly: false,
    minCompletedJobs: null,
    maxCompletedJobs: null,
    serviceTypeInterest: [],
    rolloutPercent: 100,
    ...overrides,
  };
}

function viewer(overrides: Partial<BannerViewer> = {}): BannerViewer {
  return {
    userId: USER_ID,
    audience: 'CUSTOMER',
    zoneId: ZONE_A,
    language: 'ar',
    platform: 'android',
    completedJobs: 4,
    isNewCustomer: false,
    usedJobTypes: [JobType.RIDE],
    ...overrides,
  };
}

describe('rolloutBucket', () => {
  it('is deterministic for the same campaign and user', () => {
    expect(rolloutBucket(CAMPAIGN_ID, USER_ID)).toBe(rolloutBucket(CAMPAIGN_ID, USER_ID));
  });

  it('always lands inside 0..99', () => {
    for (let i = 0; i < 500; i += 1) {
      const bucket = rolloutBucket(CAMPAIGN_ID, `user-${i}`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });

  it('spreads users across the range', () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 300; i += 1) buckets.add(rolloutBucket(CAMPAIGN_ID, `user-${i}`));
    expect(buckets.size).toBeGreaterThan(50);
  });

  it('gives a different bucket for a different campaign', () => {
    const other = '99999999-9999-4999-8999-999999999999';
    const sameForAll = Array.from({ length: 50 }, (_, i) => rolloutBucket(CAMPAIGN_ID, `u${i}`) === rolloutBucket(other, `u${i}`));
    expect(sameForAll.every(Boolean)).toBe(false);
  });
});

describe('isLiveAt', () => {
  it('accepts an ACTIVE campaign inside its window', () => {
    expect(isLiveAt(campaign(), NOW)).toBe(true);
  });

  it('rejects a campaign that has not started', () => {
    expect(isLiveAt(campaign({ startsAt: new Date('2026-04-01T00:00:00.000Z') }), NOW)).toBe(false);
  });

  it('rejects a campaign whose end has passed', () => {
    expect(isLiveAt(campaign({ endsAt: new Date('2026-03-10T00:00:00.000Z') }), NOW)).toBe(false);
  });

  it('accepts a campaign ending in the future', () => {
    expect(isLiveAt(campaign({ endsAt: new Date('2026-03-20T00:00:00.000Z') }), NOW)).toBe(true);
  });

  it.each([CampaignStatus.DRAFT, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED, CampaignStatus.ENDED, CampaignStatus.ARCHIVED])(
    'rejects status %s',
    (status) => {
      expect(isLiveAt(campaign({ status }), NOW)).toBe(false);
    },
  );
});

describe('matchesTargeting', () => {
  it('matches when no restriction is set', () => {
    expect(matchesTargeting(campaign(), viewer())).toBe(true);
  });

  /* ------------------------------------------------------------- audience */
  it('rejects a partner viewer on a customer campaign', () => {
    expect(matchesTargeting(campaign(), viewer({ audience: 'PARTNER' }))).toBe(false);
  });

  it('accepts a partner viewer on a partner campaign', () => {
    expect(matchesTargeting(campaign({ audiences: [BannerAudience.PARTNER] }), viewer({ audience: 'PARTNER' }))).toBe(true);
  });

  it('accepts every audience when the list is empty', () => {
    expect(matchesTargeting(campaign({ audiences: [] }), viewer({ audience: 'PARTNER' }))).toBe(true);
  });

  /* ----------------------------------------------------------------- zone */
  it('matches a targeted zone', () => {
    expect(matchesTargeting(campaign({ zoneIds: [ZONE_A] }), viewer())).toBe(true);
  });

  it('rejects a viewer in another zone', () => {
    expect(matchesTargeting(campaign({ zoneIds: [ZONE_B] }), viewer())).toBe(false);
  });

  it('rejects a viewer with no resolved zone when zones are targeted', () => {
    expect(matchesTargeting(campaign({ zoneIds: [ZONE_A] }), viewer({ zoneId: null }))).toBe(false);
  });

  it('accepts a viewer with no zone when the campaign targets all zones', () => {
    expect(matchesTargeting(campaign(), viewer({ zoneId: null }))).toBe(true);
  });

  /* ------------------------------------------------------------- language */
  it('matches the targeted language', () => {
    expect(matchesTargeting(campaign({ languages: ['ar'] }), viewer({ language: 'ar' }))).toBe(true);
  });

  it('rejects another language', () => {
    expect(matchesTargeting(campaign({ languages: ['en'] }), viewer({ language: 'ar' }))).toBe(false);
  });

  /* ------------------------------------------------------------- platform */
  it('matches the targeted platform', () => {
    expect(matchesTargeting(campaign({ platforms: ['android'] }), viewer({ platform: 'android' }))).toBe(true);
  });

  it('rejects another platform', () => {
    expect(matchesTargeting(campaign({ platforms: ['ios'] }), viewer({ platform: 'android' }))).toBe(false);
  });

  it('rejects an unknown platform when platforms are targeted', () => {
    const v = viewer();
    delete v.platform;
    expect(matchesTargeting(campaign({ platforms: ['ios'] }), v)).toBe(false);
  });

  /* -------------------------------------------------------- new customers */
  it('accepts a new customer for a new-customers-only campaign', () => {
    expect(matchesTargeting(campaign({ newCustomersOnly: true }), viewer({ isNewCustomer: true }))).toBe(true);
  });

  it('rejects a returning customer for a new-customers-only campaign', () => {
    expect(matchesTargeting(campaign({ newCustomersOnly: true }), viewer({ isNewCustomer: false }))).toBe(false);
  });

  /* ------------------------------------------------------- completed jobs */
  it('rejects below minCompletedJobs', () => {
    expect(matchesTargeting(campaign({ minCompletedJobs: 5 }), viewer({ completedJobs: 4 }))).toBe(false);
  });

  it('accepts at minCompletedJobs', () => {
    expect(matchesTargeting(campaign({ minCompletedJobs: 4 }), viewer({ completedJobs: 4 }))).toBe(true);
  });

  it('rejects above maxCompletedJobs', () => {
    expect(matchesTargeting(campaign({ maxCompletedJobs: 3 }), viewer({ completedJobs: 4 }))).toBe(false);
  });

  it('accepts at maxCompletedJobs', () => {
    expect(matchesTargeting(campaign({ maxCompletedJobs: 4 }), viewer({ completedJobs: 4 }))).toBe(true);
  });

  it('accepts a zero-job viewer inside an explicit 0..0 band', () => {
    expect(matchesTargeting(campaign({ minCompletedJobs: 0, maxCompletedJobs: 0 }), viewer({ completedJobs: 0 }))).toBe(true);
  });

  /* --------------------------------------------------- service type interest */
  it('matches when the viewer used one of the targeted services', () => {
    expect(matchesTargeting(campaign({ serviceTypeInterest: [JobType.RIDE, JobType.DELIVERY] }), viewer({ usedJobTypes: [JobType.DELIVERY] }))).toBe(true);
  });

  it('rejects when the viewer never used any targeted service', () => {
    expect(matchesTargeting(campaign({ serviceTypeInterest: [JobType.HOME_SERVICE] }), viewer({ usedJobTypes: [JobType.RIDE] }))).toBe(false);
  });

  it('rejects a viewer with no history when a service interest is targeted', () => {
    expect(matchesTargeting(campaign({ serviceTypeInterest: [JobType.RIDE] }), viewer({ usedJobTypes: [] }))).toBe(false);
  });

  /* ---------------------------------------------------------------- rollout */
  it('accepts everyone at 100%', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(matchesTargeting(campaign(), viewer({ userId: `user-${i}` }))).toBe(true);
    }
  });

  it('accepts only viewers under the rollout bucket', () => {
    const c = campaign({ rolloutPercent: 20 });
    for (let i = 0; i < 100; i += 1) {
      const userId = `user-${i}`;
      expect(matchesTargeting(c, viewer({ userId }))).toBe(rolloutBucket(CAMPAIGN_ID, userId) < 20);
    }
  });

  it('rolls anonymous viewers out consistently', () => {
    const c = campaign({ rolloutPercent: 50 });
    const first = matchesTargeting(c, viewer({ userId: ANONYMOUS_VIEWER_ID }));
    const second = matchesTargeting(c, viewer({ userId: ANONYMOUS_VIEWER_ID }));
    expect(first).toBe(second);
  });

  it('ANDs every rule together', () => {
    const c = campaign({ zoneIds: [ZONE_A], languages: ['ar'], platforms: ['android'], minCompletedJobs: 1, serviceTypeInterest: [JobType.RIDE] });
    expect(matchesTargeting(c, viewer())).toBe(true);
    expect(matchesTargeting(c, viewer({ language: 'en' }))).toBe(false);
    expect(matchesTargeting(c, viewer({ zoneId: ZONE_B }))).toBe(false);
    expect(matchesTargeting(c, viewer({ completedJobs: 0 }))).toBe(false);
  });
});

describe('compareBannerOrder', () => {
  it('sorts by priority desc, then sortOrder asc, then id', () => {
    const banners = [
      { id: 'c', priority: 5, sortOrder: 1 },
      { id: 'a', priority: 10, sortOrder: 2 },
      { id: 'b', priority: 10, sortOrder: 1 },
      { id: 'd', priority: 5, sortOrder: 1 },
    ];
    expect([...banners].sort(compareBannerOrder).map((b) => b.id)).toEqual(['b', 'a', 'c', 'd']);
  });
});
