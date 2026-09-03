import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';

import type { GatewayAuthorizeRequest, GatewayResult, GatewayWebhookEvent, PaymentGatewayProvider } from './payment-gateway.provider';

/** Used when no external gateway is configured: card payments are reported as disabled. */
@Injectable()
export class NoneGatewayProvider implements PaymentGatewayProvider {
  readonly name = 'none';
  async authorize(_req: GatewayAuthorizeRequest): Promise<GatewayResult> {
    throw AppException.badRequest(ErrorCode.PAYMENT_METHOD_DISABLED, 'Online payments are not enabled');
  }
  async capture(): Promise<GatewayResult> {
    throw AppException.badRequest(ErrorCode.PAYMENT_METHOD_DISABLED, 'Online payments are not enabled');
  }
  async refund(): Promise<GatewayResult> {
    throw AppException.badRequest(ErrorCode.PAYMENT_METHOD_DISABLED, 'Online payments are not enabled');
  }
  parseWebhook(): GatewayWebhookEvent {
    throw AppException.forbidden('No payment gateway configured');
  }
}
