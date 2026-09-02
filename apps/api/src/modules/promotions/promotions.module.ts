import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { ReferralsService } from './referrals.service';

/** Promo codes and the referral programme (spec §60, §61). */
@Module({
  imports: [LedgerModule, WalletModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, ReferralsService],
  exports: [PromotionsService, ReferralsService],
})
export class PromotionsModule {}
