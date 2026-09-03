import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type ManualAssignInput, type NearbyPartnersQueryInput, type RespondToOfferInput, manualAssignSchema, nearbyPartnersQuerySchema, respondToOfferSchema } from '@tamam/validation';
import { z } from 'zod';

import { Audited, CurrentUser, RequestId, RequirePermission, RequireRole, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { JobMapper } from '../jobs/job.mapper';

import { DispatchService } from './dispatch.service';

const releaseSchema = z.object({ reason: z.string().trim().min(3).max(300) });

@ApiTags('dispatch')
@ApiBearerAuth()
@Controller()
export class DispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly mapper: JobMapper,
  ) {}

  @Get('partners/me/offers') @RequireRole('PARTNER')
  offers(@CurrentUser() user: RequestUser) { return this.dispatch.listOffers(user); }

  @Post('partners/me/offers/respond') @HttpCode(200) @RequireRole('PARTNER')
  async respond(@CurrentUser() user: RequestUser, @ZodBody(respondToOfferSchema) input: RespondToOfferInput) {
    const job = await this.dispatch.respond(user, input.assignmentId, input.accept, input.location);
    return job ? this.mapper.toDto(job, user) : { accepted: false };
  }

  @Post('jobs/:id/release') @HttpCode(200) @RequireRole('PARTNER')
  async release(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(releaseSchema) body: { reason: string }) {
    await this.dispatch.releaseByPartner(id, user, body.reason);
    return { ok: true };
  }

  @Post('jobs/:id/retry-dispatch') @HttpCode(200) @RequireRole('CUSTOMER')
  async retry(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    await this.dispatch.retry(id, user);
    return { ok: true };
  }

  /* --------------------------------------------------------- dispatcher */
  @Get('admin/dispatch/nearby-partners') @RequirePermission(Permission.DISPATCH_MANUAL_ASSIGN)
  nearby(@ZodQuery(nearbyPartnersQuerySchema) q: NearbyPartnersQueryInput) { return this.dispatch.nearbyPartners(q); }

  @Get('admin/jobs/:id/assignments') @RequirePermission(Permission.JOBS_READ_ALL)
  assignments(@Param('id', UuidPipe) id: string) { return this.dispatch.assignmentsForJob(id); }

  @Post('admin/jobs/:id/assign') @HttpCode(200) @RequirePermission(Permission.DISPATCH_MANUAL_ASSIGN)
  @Audited({ action: 'dispatch.manual_assign', entity: 'job', entityIdFrom: 'id' })
  async assign(@CurrentUser() actor: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(manualAssignSchema) input: ManualAssignInput, @RequestId() rid: string) {
    const job = await this.dispatch.manualAssign(id, input.partnerId, actor, input.reason, input.version, rid);
    return this.mapper.toDto(job, actor);
  }

  @Post('admin/jobs/:id/redispatch') @HttpCode(200) @RequirePermission(Permission.DISPATCH_REASSIGN)
  @Audited({ action: 'dispatch.redispatch', entity: 'job', entityIdFrom: 'id' })
  async redispatch(@Param('id', UuidPipe) id: string) {
    await this.dispatch.runWave(id, 1);
    return { ok: true };
  }
}
