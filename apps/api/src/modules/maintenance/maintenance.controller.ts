import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import type { Queue } from 'bullmq';
import { z } from 'zod';

import {
  Audited,
  CurrentUser,
  RequirePermission,
  ZodBody,
  ZodParams,
} from '../../common/decorators';
import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import {
  MAINTENANCE_JOBS,
  QUEUES,
  type QueueName,
} from '../../infrastructure/queue/queue.constants';

import { type MaintenanceJobName, MaintenanceScheduler } from './maintenance.scheduler';

const MAINTENANCE_JOB_NAMES = Object.values(MAINTENANCE_JOBS) as [
  MaintenanceJobName,
  ...MaintenanceJobName[],
];

const runParamsSchema = z.object({ job: z.enum(MAINTENANCE_JOB_NAMES) });
type RunParams = z.infer<typeof runParamsSchema>;

const runBodySchema = z.object({
  reason: z.string().trim().min(5).max(500),
  /** Optional target day for the day-scoped jobs (banner rollup, daily KPIs). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
type RunBody = z.infer<typeof runBodySchema>;

export interface QueueCountsDto {
  queue: QueueName;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

/**
 * Operations endpoints for the maintenance queue (spec §160, runbooks in docs/OPERATIONS.md).
 * Running a maintenance job by hand is a platform-level action: it requires CONFIG_MANAGE *and*
 * a real SUPER_ADMIN — a delegated role that merely holds the permission is not enough.
 */
@ApiTags('admin/maintenance')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  private readonly queues: Array<{ name: QueueName; queue: Queue }>;

  constructor(
    private readonly scheduler: MaintenanceScheduler,
    @InjectQueue(QUEUES.DISPATCH) dispatch: Queue,
    @InjectQueue(QUEUES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUES.JOBS) jobs: Queue,
    @InjectQueue(QUEUES.FINANCE) finance: Queue,
    @InjectQueue(QUEUES.MEDIA) media: Queue,
    @InjectQueue(QUEUES.MAINTENANCE) maintenance: Queue,
  ) {
    this.queues = [
      { name: QUEUES.DISPATCH, queue: dispatch },
      { name: QUEUES.NOTIFICATIONS, queue: notifications },
      { name: QUEUES.JOBS, queue: jobs },
      { name: QUEUES.FINANCE, queue: finance },
      { name: QUEUES.MEDIA, queue: media },
      { name: QUEUES.MAINTENANCE, queue: maintenance },
    ];
  }

  @Post('admin/maintenance/run/:job')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(Permission.CONFIG_MANAGE)
  @Audited({
    action: 'maintenance.run',
    entity: 'maintenance_job',
    entityIdFrom: 'job',
    sensitive: true,
  })
  async run(
    @ZodParams(runParamsSchema) params: RunParams,
    @ZodBody(runBodySchema) body: RunBody,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!actor.isSuperAdmin)
      throw AppException.forbidden('Only a SUPER_ADMIN can trigger maintenance jobs');
    const { jobId } = await this.scheduler.runNow(params.job, actor.id, body.date);
    return { queued: true, job: params.job, jobId };
  }

  @Get('admin/maintenance/queues')
  @RequirePermission(Permission.CONFIG_READ)
  async queueStatus(): Promise<QueueCountsDto[]> {
    return Promise.all(
      this.queues.map(async ({ name, queue }) => {
        const [counts, paused] = await Promise.all([
          queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
          queue.isPaused(),
        ]);
        return {
          queue: name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
          paused,
        };
      }),
    );
  }
}
