import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { NOTIFICATION_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { type NotifyOptions, NotificationsService } from './notifications.service';

@Processor(QUEUES.NOTIFICATIONS, { concurrency: 20 })
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }
  async process(job: Job<NotifyOptions>): Promise<void> {
    if (job.name === NOTIFICATION_JOBS.SEND) await this.notifications.deliver(job.data);
  }
}
