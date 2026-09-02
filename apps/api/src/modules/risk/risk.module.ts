import { Global, Module } from '@nestjs/common';

import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

/**
 * Fraud/abuse signals and account restrictions (spec §86–§87).
 *
 * Global because the `assertCanX` guards are called from jobs, auth, promotions and wallet —
 * modules that must not have to import this one to satisfy the cross-module contract.
 */
@Global()
@Module({
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
