/**
 * External card/online gateway abstraction (spec §52, §181). CASH and WALLET are handled
 * in-house by PaymentsModule; only external providers implement this interface.
 */
export interface GatewayAuthorizeRequest {
  paymentId: string;
  amountMinor: bigint;
  currency: string;
  customerId: string;
  description: string;
  idempotencyKey: string;
  /** Saved payment method token, when the customer chose one. */
  paymentMethodToken?: string;
  returnUrl?: string;
}

export interface GatewayResult {
  status: 'AUTHORIZED' | 'CAPTURED' | 'REQUIRES_ACTION' | 'FAILED';
  providerRef: string | null;
  /** 3-D Secure / redirect URL when status === REQUIRES_ACTION. */
  actionUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  raw?: unknown;
}

export interface GatewayWebhookEvent {
  eventId: string;
  type: 'payment.captured' | 'payment.failed' | 'refund.processed' | 'refund.failed' | 'unknown';
  providerRef: string | null;
  amountMinor?: bigint;
  raw: unknown;
}

export interface PaymentGatewayProvider {
  readonly name: string;
  authorize(req: GatewayAuthorizeRequest): Promise<GatewayResult>;
  capture(providerRef: string, amountMinor: bigint, idempotencyKey: string): Promise<GatewayResult>;
  refund(providerRef: string, amountMinor: bigint, idempotencyKey: string): Promise<GatewayResult>;
  /** Verifies signature and parses the payload; throws on invalid signature. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): GatewayWebhookEvent;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
