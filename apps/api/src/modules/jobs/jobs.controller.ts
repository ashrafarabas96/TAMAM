import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type AdminTransitionInput, type ArriveJobInput, type CancelJobInput, type CompleteJobInput, type CreateJobInput, type JobListFilterInput, type PageRequestInput, type SimpleTransitionInput, type StartJobInput, adminTransitionSchema, arriveJobSchema, cancelJobSchema, completeJobSchema, createJobSchema, jobListFilterSchema, pageRequestSchema, shareTripSchema, simpleTransitionSchema, sosSchema, startJobSchema } from '@tamam/validation';

import { AllowRestricted, Audited, CurrentUser, Idempotent, Public, RateLimit, RequestId, RequirePermission, RequireRole, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { JobLifecycleService } from './job-lifecycle.service';
import { JobSafetyService } from './job-safety.service';
import { JobsService } from './jobs.service';

const listSchema = jobListFilterSchema.merge(pageRequestSchema);

@ApiTags('jobs')
@ApiBearerAuth()
@Controller()
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly lifecycle: JobLifecycleService,
    private readonly safety: JobSafetyService,
  ) {}

  /* --------------------------------------------------------- customer */
  @Post('jobs')
  @RequireRole('CUSTOMER')
  @Idempotent('jobs.create')
  @RateLimit({ name: 'job-create', limit: 10, windowSeconds: 600, keyBy: 'user' })
  create(@CurrentUser() user: RequestUser, @ZodBody(createJobSchema) input: CreateJobInput, @RequestId() requestId: string) {
    return this.jobs.create(user, input, requestId);
  }

  @Get('jobs')
  @AllowRestricted()
  list(@CurrentUser() user: RequestUser, @ZodQuery(listSchema) filter: JobListFilterInput & PageRequestInput) {
    return this.jobs.listForUser(user, filter);
  }

  @Get('jobs/:id')
  @AllowRestricted()
  get(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.jobs.getDto(id, user, true);
  }

  @Get('jobs/:id/timeline')
  @AllowRestricted()
  timeline(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.jobs.timeline(id, user);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(cancelJobSchema) input: CancelJobInput, @RequestId() rid: string) {
    return this.lifecycle.cancel(id, user, input, rid);
  }

  @Post('jobs/:id/confirm-work')
  @HttpCode(200)
  @RequireRole('CUSTOMER')
  confirmWork(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) input: SimpleTransitionInput, @RequestId() rid: string) {
    return this.lifecycle.confirmWork(id, user, input, rid);
  }

  @Post('jobs/:id/share')
  @HttpCode(200)
  share(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(shareTripSchema) input: { expiresInMinutes: number }) {
    return this.safety.createShareLink(id, user, input.expiresInMinutes);
  }

  @Delete('jobs/:id/share')
  async unshare(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    await this.safety.revokeShareLinks(id, user);
    return { ok: true };
  }

  @Post('jobs/:id/sos')
  @HttpCode(200)
  @RateLimit({ name: 'sos', limit: 5, windowSeconds: 600, keyBy: 'user' })
  sos(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(sosSchema) input: { location: { lat: number; lng: number }; note?: string }) {
    return this.safety.sos(id, user, input);
  }

  @Public()
  @Get('track/:token')
  @RateLimit({ name: 'track-public', limit: 120, windowSeconds: 60, keyBy: 'ip' })
  publicTrack(@Param('token') token: string) {
    return this.safety.publicTrack(token);
  }

  /* ---------------------------------------------------------- partner */
  @Post('jobs/:id/en-route') @HttpCode(200) @RequireRole('PARTNER')
  enRoute(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) i: SimpleTransitionInput, @RequestId() rid: string) { return this.lifecycle.enRoute(id, u, i, rid); }

  @Post('jobs/:id/arrive') @HttpCode(200) @RequireRole('PARTNER')
  arrive(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(arriveJobSchema) i: ArriveJobInput, @RequestId() rid: string) { return this.lifecycle.arrive(id, u, i, rid); }

  @Post('jobs/:id/start') @HttpCode(200) @RequireRole('PARTNER')
  @RateLimit({ name: 'job-start', limit: 10, windowSeconds: 300, keyBy: 'user' })
  start(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(startJobSchema) i: StartJobInput, @RequestId() rid: string) { return this.lifecycle.start(id, u, i, rid); }

  @Post('jobs/:id/complete') @HttpCode(200) @RequireRole('PARTNER')
  @RateLimit({ name: 'job-complete', limit: 10, windowSeconds: 300, keyBy: 'user' })
  complete(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(completeJobSchema) i: CompleteJobInput, @RequestId() rid: string) { return this.lifecycle.complete(id, u, i, rid); }

  @Post('jobs/:id/work/start') @HttpCode(200) @RequireRole('PARTNER')
  startWork(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) i: SimpleTransitionInput, @RequestId() rid: string) { return this.lifecycle.startWork(id, u, i, rid); }

  @Post('jobs/:id/work/waiting-for-parts') @HttpCode(200) @RequireRole('PARTNER')
  waitingForParts(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) i: SimpleTransitionInput, @RequestId() rid: string) { return this.lifecycle.waitingForParts(id, u, i, rid); }

  @Post('jobs/:id/work/resume') @HttpCode(200) @RequireRole('PARTNER')
  resumeWork(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) i: SimpleTransitionInput, @RequestId() rid: string) { return this.lifecycle.resumeWork(id, u, i, rid); }

  @Post('jobs/:id/work/complete') @HttpCode(200) @RequireRole('PARTNER')
  completeWork(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(completeJobSchema) i: CompleteJobInput, @RequestId() rid: string) { return this.lifecycle.completeWork(id, u, i, rid); }

  /* ------------------------------------------------------------ admin */
  @Get('admin/jobs') @RequirePermission(Permission.JOBS_READ_ALL)
  adminList(@CurrentUser() u: RequestUser, @ZodQuery(listSchema) f: JobListFilterInput & PageRequestInput) { return this.jobs.listForUser(u, f); }

  @Get('admin/jobs/:id') @RequirePermission(Permission.JOBS_READ_ALL)
  adminGet(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string) { return this.jobs.getDto(id, u, true); }

  @Post('admin/jobs/:id/transition') @HttpCode(200) @RequirePermission(Permission.JOBS_CANCEL)
  @Audited({ action: 'job.admin_transition', entity: 'job', entityIdFrom: 'id', sensitive: true })
  adminTransition(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(adminTransitionSchema) i: AdminTransitionInput, @RequestId() rid: string) { return this.lifecycle.adminTransition(id, u, i.toStatus, i.reason, i.version, rid); }

  @Get('admin/sos') @RequirePermission(Permission.JOBS_READ_ALL)
  sosList() { return this.safety.listOpenSos(); }

  @Post('admin/sos/:id/acknowledge') @HttpCode(200) @RequirePermission(Permission.JOBS_READ_ALL)
  async sosAck(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string) { await this.safety.acknowledgeSos(id, u); return { ok: true }; }

  @Post('admin/sos/:id/resolve') @HttpCode(200) @RequirePermission(Permission.JOBS_READ_ALL)
  async sosResolve(@CurrentUser() u: RequestUser, @Param('id', UuidPipe) id: string) { await this.safety.resolveSos(id, u); return { ok: true }; }
}
