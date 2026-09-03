import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { DISPATCH_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';

import { DispatchService } from './dispatch.service';

@Processor(QUEUES.DISPATCH, { concurrency: 10 })
export class DispatchProcessor extends WorkerHost {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; wave?: number }>): Promise<void> {
    switch (job.name) {
      case DISPATCH_JOBS.WAVE:
        await this.dispatch.runWave(job.data.jobId, job.data.wave ?? 1);
        break;
      case DISPATCH_JOBS.SCHEDULED_KICKOFF:
        await this.dispatch.runWave(job.data.jobId, 1);
        break;
      case DISPATCH_JOBS.OFFER_EXPIRED:
        await this.dispatch.onOffersExpired(job.data.jobId, job.data.wave ?? 1);
        break;
      case DISPATCH_JOBS.DISPATCH_TIMEOUT:
        await this.dispatch.onTimeout(job.data.jobId);
        break;
      default:
        this.logger.warn({ name: job.name }, 'unknown dispatch job');
    }
  }
}
