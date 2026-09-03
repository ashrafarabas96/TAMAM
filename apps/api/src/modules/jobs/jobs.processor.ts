import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { JOB_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { QuotesService } from '../quotes/quotes.service';

import { JobLifecycleService } from './job-lifecycle.service';

@Processor(QUEUES.JOBS, { concurrency: 8 })
export class JobsProcessor extends WorkerHost {
  constructor(
    private readonly lifecycle: JobLifecycleService,
    private readonly quotes: QuotesService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; quoteId?: string }>): Promise<void> {
    switch (job.name) {
      case JOB_JOBS.WAITING_CUSTOMER_TIMEOUT:
        await this.lifecycle.onWaitingCustomerTimeout(job.data.jobId);
        break;
      case JOB_JOBS.AUTO_CONFIRM_WORK:
        await this.lifecycle.onAutoConfirmWork(job.data.jobId);
        break;
      case JOB_JOBS.QUOTE_RESPONSE_TIMEOUT:
        if (job.data.quoteId) await this.quotes.onResponseTimeout(job.data.quoteId);
        break;
      default:
        this.logger.warn({ name: job.name }, 'unknown jobs-queue job');
    }
  }
}
