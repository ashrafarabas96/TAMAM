import { Module, forwardRef } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module';
import { PricingModule } from '../pricing/pricing.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [forwardRef(() => JobsModule), PricingModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
