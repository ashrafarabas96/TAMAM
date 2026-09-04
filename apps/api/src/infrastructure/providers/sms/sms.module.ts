import { Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AppConfigService } from '../../../config';

import { ConsoleSmsProvider } from './console-sms.provider';
import { HttpSmsProvider } from './http-sms.provider';
import { SMS_PROVIDER } from './sms.provider';

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [AppConfigService, PinoLogger],
      useFactory: (config: AppConfigService, logger: PinoLogger) =>
        config.env.SMS_PROVIDER === 'http'
          ? new HttpSmsProvider(config)
          : new ConsoleSmsProvider(logger),
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
