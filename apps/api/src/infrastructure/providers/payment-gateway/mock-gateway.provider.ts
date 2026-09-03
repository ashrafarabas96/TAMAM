import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config';

import type { GatewayAuthorizeRequest, GatewayResult, GatewayWebhookEvent, PaymentGatewayProvider } from './payment-gateway.provider';

/**
 * Deterministic gateway for local/staging environments (refused in production by env
 * validation). Amounts ending in 99 minor units fail, everything else captures immediately.
 * Webhooks are signed with HMAC-SHA256 like a real provider so the verification path is tested.
 */
@Injectable()
export class MockGatewayProvider implements PaymentGatewayProvider {
  readonly name = 'mock';
  constructor(private readonly config: AppConfigService) {}

  async authorize(req: GatewayAuthorizeRequest): Promise<GatewayResult> {
    if (req.amountMinor % 100n === 99n) return { status: 'FAILED', providerRef: `mock_${req.paymentId}`, failureCode: 'card_declined', failureMessage: 'Card declined (mock rule)' };
    return { status: 'CAPTURED', providerRef: `mock_${req.paymentId}` };
  }
  async capture(providerRef: string): Promise<GatewayResult> {
    return { status: 'CAPTURED', providerRef };
  }
  async refund(providerRef: string): Promise<GatewayResult> {
    return { status: 'CAPTURED', providerRef: `${providerRef}_refund` };
  }
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): GatewayWebhookEvent {
    const secret = this.config.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? 'mock-webhook-secret';
    const sig = String(headers['x-mock-signature'] ?? '');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw AppException.forbidden('Invalid webhook signature');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as { id: string; type: GatewayWebhookEvent['type']; providerRef: string; amountMinor?: number };
    return { eventId: body.id, type: body.type ?? 'unknown', providerRef: body.providerRef ?? null, amountMinor: body.amountMinor !== undefined ? BigInt(body.amountMinor) : undefined, raw: body };
  }
}
