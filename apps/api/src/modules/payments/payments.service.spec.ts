import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorCode, NotificationEvent, PaymentMethod, PaymentStatus } from '@tamam/shared-types';
import type { Queue } from 'bullmq';
import type { Logger } from 'nestjs-pino';

import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { PaymentGatewayProvider } from '../../infrastructure/providers/payment-gateway/payment-gateway.provider';
import type { AuditService } from '../audit/audit.service';
import type { LedgerService } from '../ledger/ledger.service';
import type { MetricsService } from '../metrics/metrics.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { WalletService } from '../wallet/wallet.service';
import { PaymentsService } from './payments.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';

interface PaymentState {
  id: string;
  jobId: string;
  customerId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  version: number;
  currency: string;
  amountMinor: bigint;
  capturedMinor: bigint;
  refundedMinor: bigint;
  provider: string;
  providerRef: string | null;
  capturedAt: Date | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: Date;
}

function paymentState(overrides: Partial<PaymentState> = {}): PaymentState {
  return {
    id: PAYMENT_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    method: PaymentMethod.CASH,
    status: PaymentStatus.PENDING,
    version: 0,
    currency: 'ILS',
    amountMinor: 10_000n,
    capturedMinor: 0n,
    refundedMinor: 0n,
    provider: 'cash',
    providerRef: null,
    capturedAt: null,
    failureCode: null,
    failureReason: null,
    createdAt: new Date('2026-03-15T09:00:00.000Z'),
    ...overrides,
  };
}

function jobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    number: 'TM-2603-000123',
    type: 'RIDE',
    status: 'COMPLETED',
    zoneId: '55555555-5555-4555-8555-555555555555',
    currency: 'ILS',
    paymentMethod: PaymentMethod.CASH,
    customerId: CUSTOMER_ID,
    partnerId: '66666666-6666-4666-8666-666666666666',
    categoryId: null,
    breakdown: [],
    estimatedTotalMinor: 10_000n,
    finalTotalMinor: 10_000n,
    category: null,
    customer: { user: { fullName: 'Layla Nasser', phone: '+970599123456' } },
    ...overrides,
  };
}

function buildHarness(options: { payment?: PaymentState; job?: Record<string, unknown>; webhookExists?: boolean } = {}) {
  const payment = options.payment ?? paymentState();
  const job = options.job ?? jobFixture();
  const receipts: Array<Record<string, unknown>> = [];

  /* ------------------------------------------------------------- prisma */
  const txPaymentUpdateMany = jest.fn(async ({ where, data }: { where: { version?: number }; data: Record<string, unknown> }) => {
    if (payment.status === PaymentStatus.CAPTURED) return { count: 0 };
    if (where.version !== undefined && where.version !== payment.version) return { count: 0 };
    Object.assign(payment, {
      status: data.status as PaymentStatus,
      amountMinor: (data.amountMinor as bigint | undefined) ?? payment.amountMinor,
      capturedMinor: (data.capturedMinor as bigint | undefined) ?? payment.capturedMinor,
      capturedAt: (data.capturedAt as Date | undefined) ?? payment.capturedAt,
      providerRef: (data.providerRef as string | null | undefined) ?? payment.providerRef,
      version: payment.version + 1,
    });
    return { count: 1 };
  });
  const receiptCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    receipts.push(data);
    return data;
  });

  const tx = {
    payment: { updateMany: txPaymentUpdateMany, findUniqueOrThrow: jest.fn(async () => payment) },
    receipt: { findUnique: jest.fn(async () => receipts[0] ?? null), create: receiptCreate },
    serviceType: { findUnique: jest.fn(async () => ({ nameAr: 'رحلة', nameEn: 'Ride' })) },
  };

  const paymentUpdateMany = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(payment, {
      status: data.status as PaymentStatus,
      failureCode: (data.failureCode as string | null) ?? null,
      failureReason: (data.failureReason as string | null) ?? null,
    });
    return { count: 1 };
  });
  const paymentUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(payment, data));
  const webhookFindUnique = jest.fn(async () => (options.webhookExists ? { id: 'wh-existing' } : null));
  const webhookCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'wh-1', ...data }));

  const prisma = {
    job: { findUnique: jest.fn(async () => job) },
    payment: {
      findUnique: jest.fn(async () => payment),
      findFirst: jest.fn(async () => payment),
      update: paymentUpdate,
      updateMany: paymentUpdateMany,
      create: jest.fn(async () => payment),
    },
    paymentAttempt: { count: jest.fn(async () => 0), create: jest.fn(async () => ({})) },
    webhookEvent: { findUnique: webhookFindUnique, create: webhookCreate, update: jest.fn(async () => ({})) },
    nextCounter: jest.fn(async () => 42n),
    ledgerTransaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  /* --------------------------------------------------------- collaborators */
  const settleJob = jest.fn(async () => ({ id: 'tx-1' }));
  const walletBalance = jest.fn(async () => 100_000n);
  const ledger = { settleJob, walletBalance, post: jest.fn(async () => ({ id: 'tx-1' })) } as unknown as LedgerService;
  const wallets = { getOrCreate: jest.fn(async () => ({ id: 'w-1', currency: 'ILS' })) } as unknown as WalletService;
  const notify = jest.fn(async () => undefined);
  const notifications = { notify } as unknown as NotificationsService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const paymentFailuresInc = jest.fn();
  const metrics = { paymentFailures: { inc: paymentFailuresInc } } as unknown as MetricsService;
  const events = new EventEmitter2();
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;

  const authorize = jest.fn(async () => ({ status: 'CAPTURED', providerRef: 'mock_ref' }));
  const capture = jest.fn(async () => ({ status: 'CAPTURED', providerRef: 'mock_ref' }));
  const parseWebhook = jest.fn(() => ({ eventId: 'evt_1', type: 'payment.captured', providerRef: 'mock_ref', raw: { id: 'evt_1' } }));
  const gateway = { name: 'mock', authorize, capture, refund: jest.fn(), parseWebhook } as unknown as PaymentGatewayProvider;
  const queueAdd = jest.fn(async () => ({ id: 'q-1' }));
  const queue = { add: queueAdd } as unknown as Queue;

  const service = new PaymentsService(prisma, ledger, wallets, notifications, audit, metrics, events, logger, gateway, queue);

  return {
    service,
    events,
    payment,
    receipts,
    mocks: { txPaymentUpdateMany, receiptCreate, paymentUpdateMany, settleJob, walletBalance, notify, paymentFailuresInc, authorize, capture, webhookCreate, queueAdd },
  };
}

describe('PaymentsService.captureForJob', () => {
  it('captures a cash job once: settlement and receipt happen exactly one time', async () => {
    const { service, receipts, mocks } = buildHarness();

    const first = await service.captureForJob(JOB_ID);

    expect(first.payment.status).toBe(PaymentStatus.CAPTURED);
    expect(first.payment.capturedAmount).toEqual({ amount: 10_000, currency: 'ILS' });
    expect(mocks.settleJob).toHaveBeenCalledTimes(1);
    expect(mocks.receiptCreate).toHaveBeenCalledTimes(1);
    expect(String(receipts[0]?.number)).toMatch(/^RC-\d{4}-000042$/);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ event: NotificationEvent.PAYMENT_SUCCESS }));

    const second = await service.captureForJob(JOB_ID);

    expect(second.payment.status).toBe(PaymentStatus.CAPTURED);
    expect(mocks.settleJob).toHaveBeenCalledTimes(1);
    expect(mocks.receiptCreate).toHaveBeenCalledTimes(1);
    expect(mocks.txPaymentUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('emits payment.captured with the captured amount', async () => {
    const { service, events } = buildHarness();
    const captured = jest.fn();
    events.on('payment.captured', captured);

    await service.captureForJob(JOB_ID);

    expect(captured).toHaveBeenCalledWith(expect.objectContaining({ jobId: JOB_ID, amountMinor: 10_000n, method: PaymentMethod.CASH }));
  });

  it('fails a wallet payment when the balance is too low and never settles', async () => {
    const { service, events, payment, mocks } = buildHarness({
      payment: paymentState({ method: PaymentMethod.WALLET, provider: 'wallet' }),
      job: jobFixture({ paymentMethod: PaymentMethod.WALLET }),
    });
    mocks.walletBalance.mockResolvedValue(500n);
    const failed = jest.fn();
    events.on('payment.failed', failed);

    await expect(service.captureForJob(JOB_ID)).rejects.toMatchObject({ code: ErrorCode.INSUFFICIENT_WALLET_BALANCE });

    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(mocks.settleJob).not.toHaveBeenCalled();
    expect(mocks.paymentUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ event: NotificationEvent.PAYMENT_FAILED }));
    expect(mocks.paymentFailuresInc).toHaveBeenCalledWith({ method: PaymentMethod.WALLET, code: 'insufficient_balance' });
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('captures a wallet payment when the balance covers the fare', async () => {
    const { service, mocks } = buildHarness({
      payment: paymentState({ method: PaymentMethod.WALLET, provider: 'wallet' }),
      job: jobFixture({ paymentMethod: PaymentMethod.WALLET }),
    });

    const result = await service.captureForJob(JOB_ID);

    expect(result.payment.status).toBe(PaymentStatus.CAPTURED);
    expect(mocks.settleJob).toHaveBeenCalledTimes(1);
  });

  it('returns the action URL and stays pending when the gateway needs 3-D Secure', async () => {
    const { service, mocks } = buildHarness({
      payment: paymentState({ method: PaymentMethod.CARD, provider: 'mock' }),
      job: jobFixture({ paymentMethod: PaymentMethod.CARD }),
    });
    mocks.authorize.mockResolvedValue({ status: 'REQUIRES_ACTION', providerRef: 'mock_ref', actionUrl: 'https://3ds.example/challenge' } as never);

    const result = await service.captureForJob(JOB_ID);

    expect(result.actionUrl).toBe('https://3ds.example/challenge');
    expect(mocks.settleJob).not.toHaveBeenCalled();
  });

  it('marks a declined card payment failed', async () => {
    const { service, payment, mocks } = buildHarness({
      payment: paymentState({ method: PaymentMethod.CARD, provider: 'mock' }),
      job: jobFixture({ paymentMethod: PaymentMethod.CARD }),
    });
    mocks.authorize.mockResolvedValue({ status: 'FAILED', providerRef: 'mock_ref', failureCode: 'card_declined', failureMessage: 'Card declined' } as never);

    await expect(service.captureForJob(JOB_ID)).rejects.toMatchObject({ code: ErrorCode.PAYMENT_FAILED });

    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(mocks.settleJob).not.toHaveBeenCalled();
    expect(mocks.paymentFailuresInc).toHaveBeenCalledWith({ method: PaymentMethod.CARD, code: 'card_declined' });
  });
});

describe('PaymentsService.handleWebhook', () => {
  const body = Buffer.from(JSON.stringify({ id: 'evt_1' }));

  it('stores a new event and queues it for processing', async () => {
    const { service, mocks } = buildHarness();

    await expect(service.handleWebhook('mock', body, {})).resolves.toEqual({ received: true, duplicate: false });

    expect(mocks.webhookCreate).toHaveBeenCalledTimes(1);
    expect(mocks.queueAdd).toHaveBeenCalledTimes(1);
  });

  it('ignores a duplicate event without processing it again', async () => {
    const { service, mocks } = buildHarness({ webhookExists: true });

    await expect(service.handleWebhook('mock', body, {})).resolves.toEqual({ received: true, duplicate: true });

    expect(mocks.webhookCreate).not.toHaveBeenCalled();
    expect(mocks.queueAdd).not.toHaveBeenCalled();
  });

  it('rejects a webhook for an unknown provider', async () => {
    const { service } = buildHarness();

    await expect(service.handleWebhook('stripe', body, {})).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('rejects an empty body', async () => {
    const { service } = buildHarness();

    await expect(service.handleWebhook('mock', Buffer.alloc(0), {})).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
