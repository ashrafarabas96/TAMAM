import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsController } from './payments.controller';
import { PaymentsProcessor } from './payments.processor';
import { PaymentsService } from './payments.service';

/** Job payments, refunds and provider webhooks (spec §51–§54). Owns the FINANCE queue worker. */
@Module({
  imports: [LedgerModule, WalletModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsProcessor],
  exports: [PaymentsService],
})
export class PaymentsModule {}
