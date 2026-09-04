import { Module } from '@nestjs/common';

import { AppConfigService } from '../../../config';

import { MockGatewayProvider } from './mock-gateway.provider';
import { NoneGatewayProvider } from './none-gateway.provider';
import { PAYMENT_GATEWAY } from './payment-gateway.provider';

/**
 * Real gateways (Lahza, Stripe, …) are added as new classes implementing PaymentGatewayProvider
 * and selected here — business logic never imports a vendor SDK (spec §52).
 */
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.env.PAYMENT_GATEWAY_PROVIDER === 'mock'
          ? new MockGatewayProvider(config)
          : new NoneGatewayProvider(),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentGatewayModule {}
