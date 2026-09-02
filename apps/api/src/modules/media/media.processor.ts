import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { MEDIA_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { MediaService } from './media.service';

@Processor(QUEUES.MEDIA, { concurrency: 4 })
export class MediaProcessor extends WorkerHost {
  constructor(
    private readonly media: MediaService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<{ mediaId: string }>): Promise<void> {
    switch (job.name) {
      case MEDIA_JOBS.PROCESS_IMAGE:
        await this.media.processImage(job.data.mediaId);
        break;
      case MEDIA_JOBS.SCAN:
        await this.media.scan(job.data.mediaId);
        break;
      default:
        this.logger.warn({ name: job.name }, 'unknown media job');
    }
  }
}
