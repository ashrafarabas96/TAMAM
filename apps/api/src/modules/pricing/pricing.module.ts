import { Global, Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { MediaModule } from '../media/media.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Global()
@Module({
  imports: [LedgerModule, MediaModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
