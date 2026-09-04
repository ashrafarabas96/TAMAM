import { Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AppConfigService } from '../../../config';

import { GoogleMapsProvider } from './google-maps.provider';
import { MAPS_PROVIDER } from './maps.provider';
import { OsrmMapsProvider } from './osrm-maps.provider';

@Module({
  providers: [
    {
      provide: MAPS_PROVIDER,
      inject: [AppConfigService, PinoLogger],
      useFactory: (config: AppConfigService, logger: PinoLogger) =>
        config.env.MAPS_PROVIDER === 'google'
          ? new GoogleMapsProvider(config)
          : new OsrmMapsProvider(config, logger),
    },
  ],
  exports: [MAPS_PROVIDER],
})
export class MapsModule {}
