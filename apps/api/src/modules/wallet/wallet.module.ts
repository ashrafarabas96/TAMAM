import { Module, forwardRef } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/** Customer/partner wallets, top-ups, admin adjustments and partner withdrawals (spec §55). */
@Module({
  imports: [forwardRef(() => LedgerModule)],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
