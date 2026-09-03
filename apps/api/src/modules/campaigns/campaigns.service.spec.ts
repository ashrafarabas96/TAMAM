import { BannerActionType, BannerAudience, BannerPlacement, CampaignStatus, JobType, Permission } from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import type { AuditService } from '../audit/audit.service';
import type { SystemConfigService } from '../config/system-config.service';
import type { MediaUrlService } from '../media/media-url.service';
import type { ZonesService } from '../zones/zones.service';

import { BannerFeedService } from './banner-feed.service';
import { CampaignsService } from './campaigns.service';
import { PLACEMENT_LIMITS } from './campaigns.types';
import { ANONYMOUS_VIEWER_ID, type BannerViewer } from './domain/banner-targeting';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_A = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-05-20T12:00:00.000Z');

function actor(permissions: Permission[] = [Permission.CAMPAIGNS_MANAGE, Permission.CAMPAIGNS_PUBLISH]): RequestUser {
  return {
    id: ACTOR_ID,
    phone: '+970599000000',
    roles: [],
    permissions,
    accountStatus: 'ACTIVE',
    sessionId: 'session-1',
    deviceId: 'device-1',
    language: 'en',
    isSuperAdmin: false,
  } as RequestUser;
}

function mediaRef() {
  return { bucket: 'public', objectKey: 'banners/a.webp', isPublic: true, mediumKey: null, thumbnailKey: null };
}

function bannerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    campaignId: CAMPAIGN_ID,
    placement: BannerPlacement.HOME_HERO,
    headlineAr: 'عرض',
    headlineEn: 'Offer',
    subheadlineAr: null,
    subheadlineEn: null,
    ctaLabelAr: null,
    ctaLabelEn: null,
    badgeAr: null,
    badgeEn: null,
    imageAr: mediaRef(),
    imageEn: mediaRef(),
    imageArMediaId: '55555555-5555-4555-8555-555555555555',
    imageEnMediaId: '55555555-5555-4555-8555-555555555555',
    theme: 'purple',
    actionType: BannerActionType.NONE,
    actionValue: null,
    priority: 0,
    sortOrder: 0,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    name: 'Ramadan',
    description: null,
    status: CampaignStatus.DRAFT,
    startsAt: new Date('2026-05-01T00:00:00.000Z'),
    endsAt: null,
    audiences: [BannerAudience.CUSTOMER],
    languages: [],
    platforms: [],
    newCustomersOnly: false,
    minCompletedJobs: null,
    maxCompletedJobs: null,
    serviceTypeInterest: [],
    rolloutPercent: 100,
    frequencyCapPerDay: null,
    createdById: ACTOR_ID,
    publishedById: null,
    publishedAt: null,
    pausedAt: null,
    endedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    zones: [],
    banners: [bannerRow()],
    ...overrides,
  };
}

interface Harness {
  service: CampaignsService;
  prisma: {
    campaign: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    bannerDailyStat: { findMany: jest.Mock; groupBy: jest.Mock };
    bannerEvent: { groupBy: jest.Mock };
    banner: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; deleteMany: jest.Mock; updateMany: jest.Mock };
    job: { count: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  audit: { record: jest.Mock };
  feed: { invalidateCandidateCache: jest.Mock; defaultTokenExpiry: jest.Mock; toBannerDto: jest.Mock; buildForViewer: jest.Mock };
}

function harness(current = campaignRow()): Harness {
  // Annotated because `$transaction` closes over `prismaTx`, which in turn borrows
  // `prisma.campaign` — inference cannot resolve that cycle on its own.
  const prisma: Harness['prisma'] = {
    campaign: {
      findUnique: jest.fn(async (args: { include?: unknown }) => (args.include ? current : current)),
      update: jest.fn(async () => current),
      updateMany: jest.fn(async () => ({ count: 2 })),
      create: jest.fn(async () => current),
      findMany: jest.fn(async () => [current]),
    },
    bannerDailyStat: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    bannerEvent: { groupBy: jest.fn(async () => []) },
    banner: {
      findMany: jest.fn(async () => [{ id: bannerRow().id }]),
      create: jest.fn(async () => bannerRow()),
      update: jest.fn(async () => bannerRow()),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    job: { count: jest.fn(async () => 0) },
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaTx)),
  };
  const prismaTx = {
    campaign: prisma.campaign,
    banner: prisma.banner,
    campaignZone: { deleteMany: jest.fn(async () => ({ count: 0 })), createMany: jest.fn(async () => ({ count: 0 })) },
  };
  const audit = { record: jest.fn(async () => undefined) };
  const feed = {
    invalidateCandidateCache: jest.fn(async () => undefined),
    defaultTokenExpiry: jest.fn(async () => 1_777_000_000),
    toBannerDto: jest.fn(() => ({ id: bannerRow().id, campaignId: CAMPAIGN_ID, placement: BannerPlacement.HOME_HERO })),
    buildForViewer: jest.fn(async () => []),
  };
  const service = new CampaignsService(prisma as unknown as PrismaService, audit as unknown as AuditService, feed as unknown as BannerFeedService);
  return { service, prisma, audit, feed };
}

describe('CampaignsService.changeStatus', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('publishes a DRAFT campaign whose window has opened straight to ACTIVE', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.DRAFT }));
    await h.service.changeStatus(CAMPAIGN_ID, 'PUBLISH', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.ACTIVE, publishedById: ACTOR_ID }) }));
    expect(h.feed.invalidateCandidateCache).toHaveBeenCalled();
  });

  it('publishes a future campaign as SCHEDULED', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.DRAFT, startsAt: new Date('2026-06-01T00:00:00.000Z') }));
    await h.service.changeStatus(CAMPAIGN_ID, 'PUBLISH', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.SCHEDULED }) }));
  });

  it('refuses to publish without the campaigns.publish permission', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.DRAFT }));
    await expect(h.service.changeStatus(CAMPAIGN_ID, 'PUBLISH', actor([Permission.CAMPAIGNS_MANAGE]), 'req-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(h.prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('lets a super admin publish without an explicit permission', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.DRAFT }));
    const superAdmin = { ...actor([]), isSuperAdmin: true };
    await h.service.changeStatus(CAMPAIGN_ID, 'PUBLISH', superAdmin, 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalled();
  });

  it('pauses an ACTIVE campaign and stamps pausedAt', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.ACTIVE }));
    await h.service.changeStatus(CAMPAIGN_ID, 'PAUSE', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.PAUSED, pausedAt: NOW }) }));
  });

  it('resumes a PAUSED campaign back to ACTIVE and clears pausedAt', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.PAUSED }));
    await h.service.changeStatus(CAMPAIGN_ID, 'RESUME', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.ACTIVE, pausedAt: null }) }));
  });

  it('ends an ACTIVE campaign and stamps endedAt', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.ACTIVE }));
    await h.service.changeStatus(CAMPAIGN_ID, 'END', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.ENDED, endedAt: NOW }) }));
  });

  it('archives an ENDED campaign', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.ENDED }));
    await h.service.changeStatus(CAMPAIGN_ID, 'ARCHIVE', actor(), 'req-1');
    expect(h.prisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CampaignStatus.ARCHIVED }) }));
  });

  it.each([
    [CampaignStatus.ACTIVE, 'PUBLISH' as const],
    [CampaignStatus.DRAFT, 'PAUSE' as const],
    [CampaignStatus.ACTIVE, 'RESUME' as const],
    [CampaignStatus.ENDED, 'END' as const],
    [CampaignStatus.ACTIVE, 'ARCHIVE' as const],
    [CampaignStatus.ARCHIVED, 'PUBLISH' as const],
  ])('rejects %s → %s', async (status, action) => {
    const h = harness(campaignRow({ status }));
    await expect(h.service.changeStatus(CAMPAIGN_ID, action, actor(), 'req-1')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(h.prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('writes an audit entry carrying the transition', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.ACTIVE }));
    await h.service.changeStatus(CAMPAIGN_ID, 'PAUSE', actor(), 'req-9', 'creative underperforming');
    expect(h.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'campaign.pause',
        entity: 'campaign',
        entityId: CAMPAIGN_ID,
        oldValue: { status: CampaignStatus.ACTIVE },
        newValue: { status: CampaignStatus.PAUSED },
        reason: 'creative underperforming',
        requestId: 'req-9',
      }),
      expect.anything(),
    );
  });
});

describe('CampaignsService scheduler hooks', () => {
  it('activates scheduled campaigns whose window opened', async () => {
    const h = harness();
    const result = await h.service.activateScheduled(NOW);
    expect(result).toEqual({ activated: 2 });
    expect(h.prisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: CampaignStatus.SCHEDULED }), data: { status: CampaignStatus.ACTIVE } }),
    );
    expect(h.feed.invalidateCandidateCache).toHaveBeenCalled();
  });

  it('ends campaigns whose endsAt has passed', async () => {
    const h = harness();
    const result = await h.service.endExpired(NOW);
    expect(result).toEqual({ ended: 2 });
    expect(h.prisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: CampaignStatus.ENDED, endedAt: NOW } }),
    );
  });

  it('does not invalidate caches when nothing changed', async () => {
    const h = harness();
    h.prisma.campaign.updateMany.mockResolvedValueOnce({ count: 0 });
    await h.service.activateScheduled(NOW);
    expect(h.feed.invalidateCandidateCache).not.toHaveBeenCalled();
  });
});

describe('CampaignsService.update guards', () => {
  it('refuses to edit an archived campaign', async () => {
    const h = harness(campaignRow({ status: CampaignStatus.ARCHIVED }));
    await expect(
      h.service.update(
        CAMPAIGN_ID,
        {
          name: 'New name',
          startsAt: '2026-05-01T00:00:00.000Z',
          targeting: { audiences: [BannerAudience.CUSTOMER], zoneIds: [], languages: [], platforms: [], newCustomersOnly: false, serviceTypeInterest: [], rolloutPercent: 100 },
          banners: [],
        } as never,
        actor(),
        'req-1',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('CampaignsService.preview', () => {
  it('builds a viewer from the supplied profile and ignores frequency caps', async () => {
    const h = harness();
    await h.service.preview({
      placement: BannerPlacement.HOME_HERO,
      audience: 'CUSTOMER',
      zoneId: ZONE_A,
      language: 'ar',
      platform: 'ios',
      completedJobs: 7,
      isNewCustomer: false,
      usedJobTypes: [JobType.RIDE],
    });
    expect(h.feed.buildForViewer).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ANONYMOUS_VIEWER_ID, audience: 'CUSTOMER', zoneId: ZONE_A, language: 'ar', platform: 'ios', completedJobs: 7 }),
      BannerPlacement.HOME_HERO,
      expect.objectContaining({ applyFrequencyCap: false, requireLive: false, bypassCache: true }),
    );
  });
});

/* ------------------------------------------------------------------------ */
/* Targeting integration: the real feed service over a mocked data layer.    */
/* ------------------------------------------------------------------------ */

function feedHarness(campaigns: Array<Record<string, unknown>>) {
  const prisma = {
    campaign: { findMany: jest.fn(async () => campaigns) },
    bannerEvent: { groupBy: jest.fn(async () => []) },
    customerProfile: { findUnique: jest.fn(async () => ({ completedJobs: 0, firstJobAt: null })) },
    partnerProfile: { findUnique: jest.fn(async () => ({ completedJobs: 0, createdAt: NOW })) },
    job: { groupBy: jest.fn(async () => []) },
  };
  const redis = {
    getJson: jest.fn(async () => null),
    setJson: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    client: {
      mget: jest.fn(async (): Promise<Array<string | null>> => []),
      set: jest.fn(async () => 'OK'),
    },
  };
  const systemConfig = { getNumber: jest.fn(async () => 300), isEnabled: jest.fn(async () => true) };
  const zones = { resolveZoneForPoint: jest.fn(async () => null) };
  const mediaUrls = { urlFor: jest.fn(() => 'https://cdn.tamam.test/banner.webp') };
  const config = { env: { OTP_PEPPER: 'x'.repeat(32) } };
  const service = new BannerFeedService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    systemConfig as unknown as SystemConfigService,
    zones as unknown as ZonesService,
    mediaUrls as unknown as MediaUrlService,
    config as unknown as AppConfigService,
  );
  return { service, prisma, redis, systemConfig };
}

function dbCampaign(id: string, overrides: Record<string, unknown> = {}, banners = [bannerRow({ id: `${id}-b1` })]) {
  return { ...campaignRow({ id, status: CampaignStatus.ACTIVE, banners }), ...overrides };
}

function viewer(overrides: Partial<BannerViewer> = {}): BannerViewer {
  return {
    userId: '66666666-6666-4666-8666-666666666666',
    audience: 'CUSTOMER',
    zoneId: ZONE_A,
    language: 'ar',
    platform: 'android',
    completedJobs: 3,
    isNewCustomer: false,
    usedJobTypes: [JobType.RIDE],
    ...overrides,
  };
}

describe('BannerFeedService.buildForViewer (targeting integration)', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('keeps only campaigns whose targeting matches the viewer', async () => {
    const h = feedHarness([
      dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { zones: [{ zoneId: ZONE_A }] }),
      dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', { zones: [{ zoneId: '99999999-9999-4999-8999-999999999999' }] }),
      dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', { languages: ['en'] }),
    ]);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: false, requireLive: true });
    expect(banners.map((b) => b.campaignId)).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']);
  });

  it('drops campaigns that are not live right now when requireLive is set', async () => {
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { endsAt: new Date('2026-05-10T00:00:00.000Z') })]);
    const live = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: false, requireLive: true });
    expect(live).toHaveLength(0);
    const preview = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: false, requireLive: false });
    expect(preview).toHaveLength(1);
  });

  it('orders by priority then sortOrder and caps at the placement limit', async () => {
    const many = Array.from({ length: PLACEMENT_LIMITS.HOME_HERO + 3 }, (_, i) =>
      bannerRow({ id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${String(i).padStart(2, '0')}`, priority: i, sortOrder: 0 }),
    );
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', {}, many)]);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: false, requireLive: true });
    expect(banners).toHaveLength(PLACEMENT_LIMITS.HOME_HERO);
    expect(banners.map((b) => b.priority)).toEqual([...banners.map((b) => b.priority)].sort((a, b) => b - a));
    expect(banners[0]?.priority).toBe(many.length - 1);
  });

  it('issues a distinct signed tracking token per banner', async () => {
    const h = feedHarness([
      dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', {}, [bannerRow({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' })]),
      dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', {}, [bannerRow({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2' })]),
    ]);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: false, requireLive: true });
    expect(banners).toHaveLength(2);
    expect(banners[0]?.trackingToken).not.toEqual(banners[1]?.trackingToken);
    expect(banners[0]?.creative.imageUrl).toEqual({ ar: 'https://cdn.tamam.test/banner.webp', en: 'https://cdn.tamam.test/banner.webp' });
  });

  it('excludes a campaign the viewer has already seen its daily cap of', async () => {
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { frequencyCapPerDay: 2 })]);
    h.redis.client.mget.mockResolvedValueOnce(['2']);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: true, requireLive: true });
    expect(banners).toHaveLength(0);
  });

  it('keeps a capped campaign while the viewer is below the cap', async () => {
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { frequencyCapPerDay: 2 })]);
    h.redis.client.mget.mockResolvedValueOnce(['1']);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: true, requireLive: true });
    expect(banners).toHaveLength(1);
  });

  it('rebuilds a missing frequency counter from banner_events', async () => {
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { frequencyCapPerDay: 1 })]);
    h.redis.client.mget.mockResolvedValueOnce([null]);
    h.prisma.bannerEvent.groupBy.mockResolvedValueOnce([{ campaignId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', _count: { _all: 4 } }] as never);
    const banners = await h.service.buildForViewer(viewer(), BannerPlacement.HOME_HERO, { applyFrequencyCap: true, requireLive: true });
    expect(banners).toHaveLength(0);
    expect(h.prisma.bannerEvent.groupBy).toHaveBeenCalled();
  });

  it('never applies frequency caps to anonymous viewers', async () => {
    const h = feedHarness([dbCampaign('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', { frequencyCapPerDay: 1 })]);
    const banners = await h.service.buildForViewer(viewer({ userId: ANONYMOUS_VIEWER_ID }), BannerPlacement.HOME_HERO, { applyFrequencyCap: true, requireLive: true });
    expect(banners).toHaveLength(1);
    expect(h.redis.client.mget).not.toHaveBeenCalled();
  });
});
