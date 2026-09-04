import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type LocationSample, Permission } from '@tamam/shared-types';
import {
  type LiveMapQueryInput,
  type LocationBatchInput,
  liveMapQuerySchema,
  locationBatchSchema,
} from '@tamam/validation';

import {
  AllowRestricted,
  CurrentUser,
  RateLimit,
  RequirePermission,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { AppException } from '../../common/errors/app.exception';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { JobsService } from '../jobs/jobs.service';

import { TrackingService } from './tracking.service';

@ApiTags('tracking')
@ApiBearerAuth()
@Controller()
export class TrackingController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly jobs: JobsService,
  ) {}

  /** REST fallback for location batches when the socket is down (spec §104). */
  @Post('partners/me/location')
  @HttpCode(200)
  @RequireRole('PARTNER')
  @RateLimit({ name: 'location-rest', limit: 120, windowSeconds: 60, keyBy: 'user' })
  push(@CurrentUser() user: RequestUser, @ZodBody(locationBatchSchema) input: LocationBatchInput) {
    if (!user.partnerId) throw AppException.forbidden();
    return this.tracking.ingestForPartner(
      user.partnerId,
      input.samples as LocationSample[],
      input.jobId,
    );
  }

  /** Polling fallback for customers: partner position + ETA for an active job. */
  @Get('jobs/:id/location')
  @AllowRestricted()
  async jobLocation(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    const job = await this.jobs.getForUser(id, user);
    const location = job.partnerId
      ? await this.tracking.latestPartnerLocation(job.partnerId)
      : null;
    return {
      jobId: job.id,
      status: job.status,
      location,
      etaToPickupSeconds: job.etaToPickupSeconds,
      etaToDestinationSeconds: job.etaToDestinationSeconds,
    };
  }

  @Get('jobs/:id/path')
  @AllowRestricted()
  async path(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    await this.jobs.getForUser(id, user);
    return { points: await this.tracking.jobPath(id) };
  }

  @Get('admin/live-map')
  @RequirePermission(Permission.TRACKING_VIEW_LIVE_MAP)
  liveMap(@ZodQuery(liveMapQuerySchema) q: LiveMapQueryInput) {
    return this.tracking.liveMap(q);
  }
}
