import { Module, forwardRef } from '@nestjs/common';

import { WalletModule } from '../wallet/wallet.module';

import { CommissionService } from './commission.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

/**
 * The single writer of `ledger_transactions`, `ledger_entries` and `wallets.balance_minor`
 * (spec §56). WalletModule is a mutual dependency: wallets need the ledger to move money, the
 * ledger needs wallets to resolve accounts — hence forwardRef on both sides.
 */
@Module({
  imports: [forwardRef(() => WalletModule)],
  controllers: [LedgerController],
  providers: [LedgerService, CommissionService],
  exports: [LedgerService, CommissionService],
})
export class LedgerModule {}
