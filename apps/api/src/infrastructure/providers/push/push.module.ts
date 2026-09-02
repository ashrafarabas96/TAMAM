import { Module } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AppConfigService } from '../../../config';
import { ConsolePushProvider } from './console-push.provider';
import { FcmPushProvider } from './fcm-push.provider';
import { PUSH_PROVIDER } from './push.provider';

@Module({
  providers: [
    {
      provide: PUSH_PROVIDER,
      inject: [AppConfigService, Logger],
      useFactory: (config: AppConfigService, logger: Logger) => (config.env.PUSH_PROVIDER === 'fcm' ? new FcmPushProvider(config, logger) : new ConsolePushProvider(logger)),
    },
  ],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
