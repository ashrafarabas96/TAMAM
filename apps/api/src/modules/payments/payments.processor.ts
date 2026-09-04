import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { FINANCE_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { LedgerService } from '../ledger/ledger.service';

import { PaymentsService } from './payments.service';

interface FinanceJobData {
  webhookEventId?: string;
  jobId?: string;
}

/** Finance queue worker: provider webhooks and out-of-band job settlement (spec §54, §56). */
@Processor(QUEUES.FINANCE, { concurrency: 4 })
export class PaymentsProcessor extends WorkerHost {
  constructor(
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<FinanceJobData>): Promise<void> {
    switch (job.name) {
      case FINANCE_JOBS.PROCESS_WEBHOOK: {
        const webhookEventId = job.data.webhookEventId;
        if (!webhookEventId)
          throw AppException.validation([
            { field: 'webhookEventId', message: 'missing webhookEventId' },
          ]);
        await this.payments.processWebhook(webhookEventId);
        break;
      }
      case FINANCE_JOBS.SETTLE_JOB: {
        const jobId = job.data.jobId;
        if (!jobId) throw AppException.validation([{ field: 'jobId', message: 'missing jobId' }]);
        await this.ledger.settleJob(jobId);
        break;
      }
      default:
        this.logger.warn({ name: job.name }, 'unknown finance job');
    }
  }
}
