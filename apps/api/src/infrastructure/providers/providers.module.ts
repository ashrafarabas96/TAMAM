import { Global, Module } from '@nestjs/common';

import { EmailModule } from './email/email.module';
import { MapsModule } from './maps/maps.module';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { PushModule } from './push/push.module';
import { SmsModule } from './sms/sms.module';
import { StorageModule } from './storage/storage.module';

/** All vendor abstractions in one global module so feature modules only inject interfaces. */
@Global()
@Module({
  imports: [MapsModule, SmsModule, PushModule, EmailModule, StorageModule, PaymentGatewayModule],
  exports: [MapsModule, SmsModule, PushModule, EmailModule, StorageModule, PaymentGatewayModule],
})
export class ProvidersModule {}
