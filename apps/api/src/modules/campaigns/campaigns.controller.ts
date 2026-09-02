import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BannerPlacement, CampaignStatus, JobType, Permission } from '@tamam/shared-types';
import {
  type BannerEventBatchInput,
  type BannerFeedQueryInput,
  type CampaignStatusActionInput,
  type UpsertCampaignInput,
  bannerEventBatchSchema,
  bannerFeedQuerySchema,
  campaignStatsQuerySchema,
  campaignStatusActionSchema,
  pageRequestSchema,
  upsertCampaignSchema,
  uuidSchema,
} from '@tamam/validation';
import { z } from 'zod';

import { AcceptLanguage, Audited, CurrentUser, Public, RateLimit, RequestId, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { BannerEventsService } from './banner-events.service';
import { BannerFeedService } from './banner-feed.service';
import { CampaignsService } from './campaigns.service';

/** The client reports the platform alongside a batch so events can be segmented by app. */
const bannerEventQuerySchema = z.object({ platform: z.enum(['ios', 'android', 'web']).optional() });

const campaignListSchema = pageRequestSchema.extend({
  status: z.nativeEnum(CampaignStatus).optional(),
  q: z.string().trim().max(120).optional(),
});

/** Synthetic viewer used by the admin targeting preview. */
const campaignPreviewSchema = z.object({
  placement: z.nativeEnum(BannerPlacement),
  audience: z.enum(['CUSTOMER', 'PARTNER']).default('CUSTOMER'),
  zoneId: uuidSchema.optional(),
  language: z.enum(['ar', 'en']).default('ar'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  completedJobs: z.number().int().min(0).max(100_000).default(0),
  isNewCustomer: z.boolean().default(true),
  usedJobTypes: z.array(z.nativeEnum(JobType)).default([]),
  userId: uuidSchema.optional(),
});

@ApiTags('campaigns')
@Controller()
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly feed: BannerFeedService,
    private readonly bannerEvents: BannerEventsService,
  ) {}

  /* ----------------------------------------------------------- app routes */

  /** Banner feed for one placement. Works signed-out; targeting sharpens once a token is present. */
  @Public()
  @Get('banners/feed')
  @RateLimit({ name: 'banner-feed', limit: 60, windowSeconds: 60, keyBy: 'user-or-ip' })
  getFeed(
    @ZodQuery(bannerFeedQuerySchema) query: BannerFeedQueryInput,
    @CurrentUser() user: RequestUser | undefined,
    @AcceptLanguage() language: 'ar' | 'en',
  ) {
    return this.feed.getFeed(user ?? null, query, language);
  }

  /** Batched impression/click/dismiss events. Each event carries the signed tracking token. */
  @Public()
  @Post('banners/events')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'banner-events', limit: 120, windowSeconds: 60, keyBy: 'user-or-ip' })
  ingestEvents(
    @ZodBody(bannerEventBatchSchema) body: BannerEventBatchInput,
    @ZodQuery(bannerEventQuerySchema) query: { platform?: 'ios' | 'android' | 'web' },
    @CurrentUser() user: RequestUser | undefined,
  ) {
    return this.bannerEvents.ingest(user ?? null, body, query.platform ?? null);
  }

  /* --------------------------------------------------------- admin routes */

  @ApiBearerAuth()
  @Get('admin/campaigns')
  @RequirePermission(Permission.CAMPAIGNS_READ)
  list(@ZodQuery(campaignListSchema) query: z.infer<typeof campaignListSchema>) {
    return this.campaigns.list({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
    });
  }

  @ApiBearerAuth()
  @Get('admin/campaigns/:id')
  @RequirePermission(Permission.CAMPAIGNS_READ)
  get(@Param('id', UuidPipe) id: string) {
    return this.campaigns.get(id);
  }

  @ApiBearerAuth()
  @Post('admin/campaigns')
  @RequirePermission(Permission.CAMPAIGNS_MANAGE)
  @Audited({ action: 'campaign.create', entity: 'campaign' })
  create(@ZodBody(upsertCampaignSchema) input: UpsertCampaignInput, @CurrentUser() user: RequestUser, @RequestId() requestId: string) {
    return this.campaigns.create(input, user, requestId);
  }

  @ApiBearerAuth()
  @Put('admin/campaigns/:id')
  @RequirePermission(Permission.CAMPAIGNS_MANAGE)
  @Audited({ action: 'campaign.update', entity: 'campaign', entityIdFrom: 'id' })
  update(
    @Param('id', UuidPipe) id: string,
    @ZodBody(upsertCampaignSchema) input: UpsertCampaignInput,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.campaigns.update(id, input, user, requestId);
  }

  /**
   * Workflow action. Not decorated with `@Audited`: the service writes a richer entry inside the
   * same transaction (old → new status), so a second generic row would only duplicate it.
   */
  @ApiBearerAuth()
  @Post('admin/campaigns/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CAMPAIGNS_MANAGE)
  changeStatus(
    @Param('id', UuidPipe) id: string,
    @ZodBody(campaignStatusActionSchema) body: CampaignStatusActionInput,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.campaigns.changeStatus(id, body.action, user, requestId, body.reason);
  }

  @ApiBearerAuth()
  @Get('admin/campaigns/:id/stats')
  @RequirePermission(Permission.CAMPAIGNS_READ)
  stats(@Param('id', UuidPipe) id: string, @ZodQuery(campaignStatsQuerySchema) query: { from?: string; to?: string }) {
    return this.campaigns.stats(id, query.from, query.to);
  }

  @ApiBearerAuth()
  @Post('admin/campaigns/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.CAMPAIGNS_READ)
  preview(@ZodBody(campaignPreviewSchema) input: z.infer<typeof campaignPreviewSchema>) {
    return this.campaigns.preview({
      placement: input.placement,
      audience: input.audience,
      language: input.language,
      completedJobs: input.completedJobs,
      isNewCustomer: input.isNewCustomer,
      usedJobTypes: input.usedJobTypes,
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
    });
  }
}
