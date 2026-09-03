import { Module, forwardRef } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { MediaModule } from '../media/media.module';
import { PartnersModule } from '../partners/partners.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { QuotesModule } from '../quotes/quotes.module';
import { TrackingModule } from '../tracking/tracking.module';
import { JobLifecycleService } from './job-lifecycle.service';
import { JobSafetyService } from './job-safety.service';
import { JobMapper } from './job.mapper';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    MediaModule,
    PricingModule,
    PromotionsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => ChatModule),
    forwardRef(() => DispatchModule),
    forwardRef(() => TrackingModule),
    forwardRef(() => PartnersModule),
    forwardRef(() => QuotesModule),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobLifecycleService, JobSafetyService, JobMapper, JobsProcessor],
  // JobSafetyService is exported so AdminModule can count open SOS alerts on the overview screen.
  exports: [JobsService, JobLifecycleService, JobMapper, JobSafetyService],
})
export class JobsModule {}
