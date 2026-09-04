import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { AppConfigModule, AppConfigService } from '../../config';

import { QUEUES } from './queue.constants';

const queueRegistrations = Object.values(QUEUES).map((name) =>
  BullModule.registerQueue({
    name,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  }),
);

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.env.REDIS_URL);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
          prefix: 'tamam',
        };
      },
    }),
    ...queueRegistrations,
  ],
  exports: [BullModule],
})
export class QueueModule {}
