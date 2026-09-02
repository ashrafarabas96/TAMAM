import { Global, Module } from '@nestjs/common';

import { ConfigController } from './config.controller';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
  controllers: [ConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
