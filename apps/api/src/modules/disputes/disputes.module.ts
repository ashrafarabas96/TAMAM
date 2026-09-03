import { Module, forwardRef } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MediaModule } from '../media/media.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletModule } from '../wallet/wallet.module';

import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

/**
 * Dispute intake and settlement (spec §64). `JobsModule` is a mutual dependency — jobs open
 * disputes on the customer's behalf, disputes move jobs in and out of DISPUTED — hence forwardRef.
 */
@Module({
  imports: [forwardRef(() => JobsModule), PaymentsModule, LedgerModule, WalletModule, MediaModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
