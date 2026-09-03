import { Module, forwardRef } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module';
import { PartnersModule } from '../partners/partners.module';
import { PricingModule } from '../pricing/pricing.module';

import { DispatchController } from './dispatch.controller';
import { DispatchProcessor } from './dispatch.processor';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [forwardRef(() => JobsModule), forwardRef(() => PartnersModule), PricingModule],
  controllers: [DispatchController],
  providers: [DispatchService, DispatchProcessor],
  exports: [DispatchService],
})
export class DispatchModule {}
