import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { startOfUtcDay } from '../../common/utils/time';
import { MAINTENANCE_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';

export type MaintenanceJobName = (typeof MAINTENANCE_JOBS)[keyof typeof MAINTENANCE_JOBS];

export interface MaintenanceJobData {
  /** ISO date (YYYY-MM-DD) for the jobs that operate on a specific day. */
  date?: string;
  /** True when a SUPER_ADMIN triggered the job from `POST admin/maintenance/run/:job`. */
  manual?: boolean;
  triggeredBy?: string;
}

/** `yyyymmddHHMM` in UTC — the deduplication bucket for a scheduled tick. */
export function minuteStamp(at: Date = new Date()): string {
  return at.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The only place that decides *when* maintenance runs (spec §160). It never does the work: it
 * enqueues a BullMQ job whose `jobId` is `<name>-<yyyymmddHHMM>`, so N API replicas firing the
 * same cron tick produce exactly one queued job — BullMQ rejects duplicate ids.
 *
 * Cadence:
 *  - every minute  : heartbeat sweep, campaign scheduler, chalet hold expiry
 *  - every 10 min  : OTP retention, expired-session cleanup, chalet offer retirement
 *  - hourly        : banner stats rollup (today), tracking retention, chalet offer generation
 *  - daily 02:00Z  : daily KPIs (yesterday), retention sweep, document expiry
 */
@Injectable()
export class MaintenanceScheduler {
  constructor(
    @InjectQueue(QUEUES.MAINTENANCE) private readonly queue: Queue<MaintenanceJobData>,
    private readonly logger: PinoLogger,
  ) {}

  @Cron('* * * * *', { name: 'maintenance.minute', timeZone: 'UTC' })
  async everyMinute(): Promise<void> {
    const stamp = minuteStamp();
    await Promise.all([
      this.enqueue(MAINTENANCE_JOBS.HEARTBEAT_SWEEP, stamp),
      this.enqueue(MAINTENANCE_JOBS.CAMPAIGN_SCHEDULER, stamp),
      // A chalet hold lasts seven minutes, so anything slower than a minute
      // would leave an abandoned checkout holding a slot for most of its life.
      this.enqueue(MAINTENANCE_JOBS.CHALET_EXPIRE_HOLDS, stamp),
    ]);
  }

  @Cron('*/10 * * * *', { name: 'maintenance.ten-minutes', timeZone: 'UTC' })
  async everyTenMinutes(): Promise<void> {
    const stamp = minuteStamp();
    await Promise.all([
      this.enqueue(MAINTENANCE_JOBS.EXPIRE_OTPS, stamp),
      this.enqueue(MAINTENANCE_JOBS.SESSION_CLEANUP, stamp),
      // An offer for a slot somebody has since taken is worse than no offer,
      // so stale ones are retired far more often than new ones are made.
      this.enqueue(MAINTENANCE_JOBS.CHALET_RETIRE_OFFERS, stamp),
    ]);
  }

  @Cron('0 * * * *', { name: 'maintenance.hourly', timeZone: 'UTC' })
  async hourly(): Promise<void> {
    const stamp = minuteStamp();
    const today = isoDate(startOfUtcDay(new Date()));
    await Promise.all([
      this.enqueue(MAINTENANCE_JOBS.BANNER_STATS_ROLLUP, stamp, { date: today }),
      this.enqueue(MAINTENANCE_JOBS.TRACKING_RETENTION, stamp),
      this.enqueue(MAINTENANCE_JOBS.CHALET_GENERATE_OFFERS, stamp),
    ]);
  }

  @Cron('0 2 * * *', { name: 'maintenance.daily', timeZone: 'UTC' })
  async daily(): Promise<void> {
    const stamp = minuteStamp();
    const yesterday = isoDate(new Date(startOfUtcDay(new Date()).getTime() - 86_400_000));
    await Promise.all([
      this.enqueue(MAINTENANCE_JOBS.DAILY_KPIS, stamp, { date: yesterday }),
      this.enqueue(MAINTENANCE_JOBS.NOTIFICATION_RETENTION, stamp),
      this.enqueue(MAINTENANCE_JOBS.EXPIRE_DOCUMENTS, stamp),
    ]);
  }

  /** Manual trigger from the admin panel — a unique id so it always runs, even within the minute. */
  async runNow(
    name: MaintenanceJobName,
    triggeredBy: string,
    date?: string,
  ): Promise<{ jobId: string }> {
    const jobId = `${name}-manual-${Date.now()}`;
    await this.queue.add(
      name,
      { manual: true, triggeredBy, ...(date ? { date } : {}) },
      { jobId, attempts: 1 },
    );
    this.logger.info({ job: name, jobId, triggeredBy }, 'maintenance job triggered manually');
    return { jobId };
  }

  private async enqueue(
    name: MaintenanceJobName,
    stamp: string,
    data: MaintenanceJobData = {},
  ): Promise<void> {
    await this.queue.add(name, data, {
      jobId: `${name}-${stamp}`,
      attempts: 3,
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }
}
