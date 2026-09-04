import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Payment, Prisma, type Refund } from '@prisma/client';
import {
  ErrorCode,
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  NotificationEvent,
  type Page,
  type PaymentDto,
  PaymentMethod,
  PaymentStatus,
  type RefundDto,
  RefundStatus,
  WalletOwnerType,
} from '@tamam/shared-types';
import type { IssueRefundInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { formatMajor, toMoney } from '../../common/utils/money';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayProvider,
} from '../../infrastructure/providers/payment-gateway/payment-gateway.provider';
import { FINANCE_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { AuditService } from '../audit/audit.service';
import { JobPolicy } from '../jobs/domain/job-policy';
import { platformAccountCode, refundEntries } from '../ledger/domain/ledger.rules';
import { LedgerService } from '../ledger/ledger.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletService } from '../wallet/wallet.service';

// Declared in @tamam/shared-types so the console and the mobile apps read the same
// shape; re-exported for the modules that already import it from this service.
export type { RefundDto } from '@tamam/shared-types';

/** Everything `createForJob` needs — a Prisma `Job` row satisfies it structurally. */
export interface JobChargeSource {
  id: string;
  customerId: string;
  currency: string;
  paymentMethod: PaymentMethod;
  estimatedTotalMinor: bigint | null;
}

export interface CaptureResult {
  payment: PaymentDto;
  /** 3-D Secure / redirect URL the customer must open before the charge can capture. */
  actionUrl: string | null;
}

export interface PaymentListFilter {
  jobId?: string;
  customerId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}

export interface RefundListFilter {
  paymentId?: string;
  status?: RefundStatus;
  disputeId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}

export interface WebhookAck {
  received: true;
  duplicate: boolean;
}

interface StoredWebhookPayload {
  providerRef: string | null;
  amountMinor: number | null;
  raw: unknown;
}

const captureJobSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  zoneId: true,
  currency: true,
  paymentMethod: true,
  customerId: true,
  partnerId: true,
  categoryId: true,
  breakdown: true,
  estimatedTotalMinor: true,
  finalTotalMinor: true,
  category: { select: { nameAr: true, nameEn: true } },
  customer: { select: { user: { select: { fullName: true, phone: true } } } },
} satisfies Prisma.JobSelect;

type CaptureJob = Prisma.JobGetPayload<{ select: typeof captureJobSelect }>;
type PaymentRow = Payment;

/**
 * Payment orchestration (spec §51–§54). One payment per job, captured when the job completes;
 * capture is idempotent, transactional and always followed by settlement + receipt. External
 * providers are reached only through `PaymentGatewayProvider`.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayProvider,
    @InjectQueue(QUEUES.FINANCE) private readonly queue: Queue,
  ) {}

  /* --------------------------------------------------------------- creation */

  /** One PENDING payment per job, keyed `job:<jobId>:charge` so retries never duplicate it. */
  async createForJob(job: JobChargeSource, tx: Tx): Promise<PaymentRow> {
    const idempotencyKey = `job:${job.id}:charge`;
    const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    try {
      return await tx.payment.create({
        data: {
          jobId: job.id,
          customerId: job.customerId,
          method: job.paymentMethod,
          currency: job.currency,
          amountMinor: job.estimatedTotalMinor ?? 0n,
          provider: this.providerFor(job.paymentMethod),
          idempotencyKey,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await tx.payment.findUnique({ where: { idempotencyKey } });
        if (raced) return raced;
      }
      throw err;
    }
  }

  private providerFor(method: PaymentMethod): string {
    if (method === PaymentMethod.CASH) return 'cash';
    if (method === PaymentMethod.WALLET) return 'wallet';
    return this.gateway.name;
  }

  /* ---------------------------------------------------------------- capture */

  /**
   * Charges the customer for a completed job. Safe to call repeatedly: an already captured
   * payment returns unchanged, and settlement/receipt creation are idempotent too.
   */
  async captureForJob(jobId: string): Promise<CaptureResult> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: captureJobSelect,
    });
    if (!job) throw AppException.notFound('Job', jobId);

    const payment = await this.ensurePayment(job);
    if (payment.status === PaymentStatus.CAPTURED)
      return { payment: this.toDto(payment), actionUrl: null };
    if (
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw AppException.conflict('This payment was already refunded', ErrorCode.CONFLICT);
    }
    if (payment.status === PaymentStatus.CANCELLED)
      throw AppException.conflict('This payment was cancelled', ErrorCode.CONFLICT);

    const amountMinor = job.finalTotalMinor ?? job.estimatedTotalMinor ?? payment.amountMinor;
    if (amountMinor < 0n)
      throw AppException.validation([
        { field: 'finalTotalMinor', message: 'job total cannot be negative' },
      ]);

    if (payment.method === PaymentMethod.CASH) {
      // The partner collected the money in person; the ledger books the cash movement.
      return {
        payment: await this.completeCapture(job, payment, amountMinor, payment.providerRef),
        actionUrl: null,
      };
    }

    if (payment.method === PaymentMethod.WALLET) {
      const wallet = await this.wallets.getOrCreate(
        WalletOwnerType.CUSTOMER,
        job.customerId,
        job.currency,
      );
      const balance = await this.ledger.walletBalance(wallet.id);
      if (balance < amountMinor) {
        await this.markFailed(
          job,
          payment,
          'insufficient_balance',
          'Wallet balance is lower than the amount due',
        );
        throw AppException.badRequest(
          ErrorCode.INSUFFICIENT_WALLET_BALANCE,
          'Wallet balance is lower than the amount due',
        );
      }
      return {
        payment: await this.completeCapture(job, payment, amountMinor, payment.providerRef),
        actionUrl: null,
      };
    }

    return this.captureViaGateway(job, payment, amountMinor);
  }

  private async ensurePayment(job: CaptureJob): Promise<PaymentRow> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: `job:${job.id}:charge` },
    });
    if (existing) return existing;
    return this.prisma.$transaction((tx) =>
      this.createForJob(
        {
          id: job.id,
          customerId: job.customerId,
          currency: job.currency,
          paymentMethod: job.paymentMethod,
          estimatedTotalMinor: job.estimatedTotalMinor,
        },
        tx,
      ),
    );
  }

  private async captureViaGateway(
    job: CaptureJob,
    payment: PaymentRow,
    amountMinor: bigint,
  ): Promise<CaptureResult> {
    const idempotencyKey = `capture:${payment.id}:${amountMinor}`;
    const authorized =
      payment.providerRef && payment.status === PaymentStatus.AUTHORIZED
        ? { status: 'AUTHORIZED' as const, providerRef: payment.providerRef }
        : await this.attempt(payment, 'AUTHORIZE', () =>
            this.gateway.authorize({
              paymentId: payment.id,
              amountMinor,
              currency: job.currency,
              customerId: job.customerId,
              description: `TAMAM job ${job.number}`,
              idempotencyKey,
            }),
          );

    if (authorized.status === 'REQUIRES_ACTION') {
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PENDING,
          providerRef: authorized.providerRef,
          amountMinor,
          version: { increment: 1 },
        },
      });
      return { payment: this.toDto(updated), actionUrl: authorized.actionUrl ?? null };
    }
    if (authorized.status === 'FAILED') {
      await this.markFailed(
        job,
        payment,
        authorized.failureCode ?? 'authorization_failed',
        authorized.failureMessage ?? 'Authorization was declined',
        authorized.providerRef,
      );
      throw AppException.badRequest(
        ErrorCode.PAYMENT_FAILED,
        authorized.failureMessage ?? 'Authorization was declined',
      );
    }

    const captured =
      authorized.status === 'CAPTURED'
        ? authorized
        : await this.attempt(payment, 'CAPTURE', () =>
            this.gateway.capture(authorized.providerRef ?? payment.id, amountMinor, idempotencyKey),
          );

    if (captured.status !== 'CAPTURED') {
      await this.markFailed(
        job,
        payment,
        captured.failureCode ?? 'capture_failed',
        captured.failureMessage ?? 'Capture was declined',
        captured.providerRef,
      );
      throw AppException.badRequest(
        ErrorCode.PAYMENT_FAILED,
        captured.failureMessage ?? 'Capture was declined',
      );
    }
    return {
      payment: await this.completeCapture(job, payment, amountMinor, captured.providerRef),
      actionUrl: null,
    };
  }

  /** Runs one provider call, timing it and storing the outcome as a `payment_attempts` row. */
  private async attempt<
    T extends {
      status: string;
      providerRef: string | null;
      failureCode?: string;
      failureMessage?: string;
      actionUrl?: string;
    },
  >(
    payment: PaymentRow,
    action: 'AUTHORIZE' | 'CAPTURE' | 'REFUND',
    call: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const attemptNumber =
      (await this.prisma.paymentAttempt.count({ where: { paymentId: payment.id } })) + 1;
    try {
      const result = await call();
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber,
          action,
          success: result.status === 'CAPTURED' || result.status === 'AUTHORIZED',
          providerRef: result.providerRef,
          responseCode: result.status,
          responseMessage: result.failureMessage ? result.failureMessage.slice(0, 300) : null,
          latencyMs: Date.now() - startedAt,
        },
      });
      return result;
    } catch (err) {
      await this.prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber,
          action,
          success: false,
          responseCode: 'EXCEPTION',
          responseMessage: err instanceof Error ? err.message.slice(0, 300) : 'provider error',
          latencyMs: Date.now() - startedAt,
        },
      });
      this.logger.error({ err, paymentId: payment.id, action }, 'payment gateway call failed');
      throw AppException.external(this.gateway.name, 'Payment provider is unavailable');
    }
  }

  /**
   * Marks the payment captured, settles the job into the ledger and issues the receipt — all in
   * one ledger transaction so money and paperwork can never diverge.
   */
  private async completeCapture(
    job: CaptureJob,
    payment: PaymentRow,
    amountMinor: bigint,
    providerRef: string | null,
  ): Promise<PaymentDto> {
    const updated = await this.prisma.withLedgerWrite(async (tx) => {
      const result = await tx.payment.updateMany({
        where: {
          id: payment.id,
          version: payment.version,
          status: { not: PaymentStatus.CAPTURED },
        },
        data: {
          status: PaymentStatus.CAPTURED,
          amountMinor,
          capturedMinor: amountMinor,
          capturedAt: new Date(),
          providerRef,
          failureCode: null,
          failureReason: null,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        // A concurrent capture already finished the work (settlement and receipt included).
        if (current.status === PaymentStatus.CAPTURED) return current;
        throw AppException.versionConflict();
      }
      await this.ledger.settleJob(job.id, tx);
      await this.issueReceipt(job, amountMinor, tx);
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    });

    if (updated.capturedAt && updated.status === PaymentStatus.CAPTURED) {
      await this.notifications.notify({
        userId: job.customerId,
        event: NotificationEvent.PAYMENT_SUCCESS,
        vars: { total: formatMajor(amountMinor, job.currency), jobNumber: job.number },
        data: { jobId: job.id, paymentId: updated.id },
        jobId: job.id,
      });
      this.events.emit('payment.captured', {
        jobId: job.id,
        paymentId: updated.id,
        amountMinor,
        method: updated.method,
      });
    }
    return this.toDto(updated);
  }

  private async markFailed(
    job: CaptureJob,
    payment: PaymentRow,
    code: string,
    message: string,
    providerRef?: string | null,
  ): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
        },
      },
      data: {
        status: PaymentStatus.FAILED,
        failureCode: code.slice(0, 60),
        failureReason: message.slice(0, 300),
        providerRef: providerRef ?? payment.providerRef,
        version: { increment: 1 },
      },
    });
    this.metrics.paymentFailures.inc({ method: payment.method, code });
    await this.notifications.notify({
      userId: job.customerId,
      event: NotificationEvent.PAYMENT_FAILED,
      vars: { jobNumber: job.number },
      data: { jobId: job.id, paymentId: payment.id, code },
      jobId: job.id,
      priority: 'high',
    });
    this.events.emit('payment.failed', {
      jobId: job.id,
      paymentId: payment.id,
      method: payment.method,
      code,
    });
  }

  /** `RC-YYMM-NNNNNN`, one per job (spec §53). */
  private async issueReceipt(job: CaptureJob, amountMinor: bigint, tx: Tx): Promise<void> {
    const existing = await tx.receipt.findUnique({
      where: { jobId: job.id },
      select: { id: true },
    });
    if (existing) return;
    const sequence = await this.prisma.nextCounter('receipt_number', tx);
    const now = new Date();
    const number = `RC-${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(sequence).padStart(6, '0')}`;
    const service = job.category
      ? { ar: job.category.nameAr, en: job.category.nameEn }
      : await this.serviceTypeName(job.type, tx);
    await tx.receipt.create({
      data: {
        jobId: job.id,
        number,
        currency: job.currency,
        totalMinor: amountMinor,
        breakdown: (job.breakdown ?? []) as Prisma.InputJsonValue,
        paymentMethod: job.paymentMethod,
        customerName: job.customer.user.fullName ?? job.customer.user.phone,
        serviceNameAr: service.ar.slice(0, 120),
        serviceNameEn: service.en.slice(0, 120),
      },
    });
  }

  private async serviceTypeName(
    code: CaptureJob['type'],
    tx: Tx,
  ): Promise<{ ar: string; en: string }> {
    const serviceType = await tx.serviceType.findUnique({
      where: { code },
      select: { nameAr: true, nameEn: true },
    });
    return serviceType
      ? { ar: serviceType.nameAr, en: serviceType.nameEn }
      : { ar: code, en: code };
  }

  /* ------------------------------------------------------------------ reads */

  async getForJob(jobId: string, user: RequestUser): Promise<PaymentDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, partnerId: true, status: true, zoneId: true },
    });
    if (!job) throw AppException.notFound('Job', jobId);
    if (!JobPolicy.canView(user, job)) throw AppException.notFound('Job', jobId); // 404, not 403: don't leak existence (spec §88)
    const payment = await this.prisma.payment.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw AppException.notFound('Payment for job', jobId);
    return this.toDto(payment);
  }

  async adminList(filter: PaymentListFilter): Promise<Page<PaymentDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.payment.findMany({
      where: {
        ...cursorWhere(cursor),
        jobId: filter.jobId,
        customerId: filter.customerId,
        status: filter.status,
        method: filter.method,
        createdAt:
          filter.from || filter.to
            ? {
                gte: filter.from ? new Date(filter.from) : undefined,
                lte: filter.to ? new Date(filter.to) : undefined,
              }
            : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (p) => this.toDto(p));
  }

  async adminGet(id: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw AppException.notFound('Payment', id);
    return this.toDto(payment);
  }

  async listRefunds(filter: RefundListFilter): Promise<Page<RefundDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.refund.findMany({
      where: {
        ...cursorWhere(cursor),
        paymentId: filter.paymentId,
        status: filter.status,
        disputeId: filter.disputeId,
        createdAt:
          filter.from || filter.to
            ? {
                gte: filter.from ? new Date(filter.from) : undefined,
                lte: filter.to ? new Date(filter.to) : undefined,
              }
            : undefined,
      },
      include: { payment: { select: { jobId: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (r) => this.toRefundDto(r, r.payment.jobId));
  }

  /* ---------------------------------------------------------------- refunds */

  /**
   * Full or partial refund (spec §54). Cash and wallet payments are refunded into the customer
   * wallet; gateway payments go back through the provider. Never exceeds what was captured.
   */
  async refund(
    input: IssueRefundInput,
    actor: RequestUser,
    requestId: string | null = null,
  ): Promise<RefundDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { job: { select: { id: true, number: true, customerId: true, currency: true } } },
    });
    if (!payment) throw AppException.notFound('Payment', input.paymentId);
    if (
      payment.status !== PaymentStatus.CAPTURED &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw AppException.conflict('Only captured payments can be refunded', ErrorCode.CONFLICT);
    }
    const amountMinor = BigInt(input.amountMinor);
    const remaining = payment.capturedMinor - payment.refundedMinor;
    if (amountMinor > remaining) {
      throw AppException.validation([
        { field: 'amountMinor', message: `at most ${remaining} can still be refunded` },
      ]);
    }
    if (input.disputeId) {
      const dispute = await this.prisma.dispute.findUnique({
        where: { id: input.disputeId },
        select: { id: true },
      });
      if (!dispute) throw AppException.notFound('Dispute', input.disputeId);
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        disputeId: input.disputeId ?? null,
        currency: payment.currency,
        amountMinor,
        reason: input.reason,
        issuedById: actor.id,
        idempotencyKey: `refund:${payment.id}:${randomUUID()}`,
      },
    });

    const viaWallet =
      payment.method === PaymentMethod.CASH || payment.method === PaymentMethod.WALLET;
    let providerRef: string | null = null;
    if (!viaWallet) {
      const result = await this.attempt(payment, 'REFUND', () =>
        this.gateway.refund(payment.providerRef ?? payment.id, amountMinor, refund.idempotencyKey),
      );
      if (result.status !== 'CAPTURED' && result.status !== 'AUTHORIZED') {
        const failed = await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.FAILED,
            failureReason: (result.failureMessage ?? 'provider refused the refund').slice(0, 300),
          },
        });
        this.metrics.paymentFailures.inc({
          method: payment.method,
          code: result.failureCode ?? 'refund_failed',
        });
        await this.audit.record({
          actorId: actor.id,
          action: 'refund.failed',
          entity: 'refund',
          entityId: refund.id,
          newValue: { paymentId: payment.id, amountMinor: input.amountMinor },
          reason: input.reason,
          requestId,
        });
        return this.toRefundDto(failed, payment.jobId);
      }
      providerRef = result.providerRef;
    }

    const processed = await this.prisma.withLedgerWrite(async (tx) => {
      const wallet = viaWallet
        ? await this.wallets.getOrCreate(
            WalletOwnerType.CUSTOMER,
            payment.job.customerId,
            payment.currency,
            tx,
          )
        : null;
      const entries = wallet
        ? refundEntries({
            amountMinor,
            currency: payment.currency,
            customerWalletAccountCode: `WALLET:${wallet.id}`,
          })
        : [
            {
              accountCode: platformAccountCode(
                LedgerAccountType.PLATFORM_REFUND_EXPENSE,
                payment.currency,
              ),
              direction: LedgerEntryDirection.DEBIT,
              amountMinor,
            },
            {
              accountCode: platformAccountCode(
                LedgerAccountType.PLATFORM_GATEWAY_CLEARING,
                payment.currency,
              ),
              direction: LedgerEntryDirection.CREDIT,
              amountMinor,
            },
          ];
      const transaction = await this.ledger.post(
        {
          type: LedgerTransactionType.REFUND,
          currency: payment.currency,
          entries,
          jobId: payment.jobId,
          paymentId: payment.id,
          refundId: refund.id,
          disputeId: input.disputeId ?? undefined,
          reference: providerRef ?? refund.id,
          description: `Refund for job ${payment.job.number}`,
          reason: input.reason,
          actorId: actor.id,
          idempotencyKey: `refund:${refund.id}`,
        },
        tx,
      );
      const refundedMinor = payment.refundedMinor + amountMinor;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedMinor,
          status:
            refundedMinor >= payment.capturedMinor
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED,
          version: { increment: 1 },
        },
      });
      const updatedRefund = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.PROCESSED,
          providerRef,
          processedAt: new Date(),
          ledgerTransactionId: transaction.id,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'refund.issue',
          entity: 'refund',
          entityId: refund.id,
          newValue: {
            paymentId: payment.id,
            jobId: payment.jobId,
            amountMinor: input.amountMinor,
            disputeId: input.disputeId ?? null,
          },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return updatedRefund;
    });

    this.logger.info(
      { refundId: processed.id, paymentId: payment.id, amountMinor: amountMinor.toString() },
      'refund processed',
    );
    return this.toRefundDto(processed, payment.jobId);
  }

  /* --------------------------------------------------------------- webhooks */

  /**
   * Stores every inbound event before doing anything with it and processes it exactly once
   * (spec §54). Signature verification happens inside the provider adapter.
   */
  async handleWebhook(
    provider: string,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookAck> {
    if (provider !== this.gateway.name) throw AppException.notFound('Payment provider', provider);
    if (!rawBody || !rawBody.length)
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Empty webhook body');

    const event = this.gateway.parseWebhook(rawBody, headers);
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId: event.eventId } },
      select: { id: true },
    });
    if (existing) {
      this.logger.info({ provider, eventId: event.eventId }, 'duplicate webhook ignored');
      return { received: true, duplicate: true };
    }

    const payload: StoredWebhookPayload = {
      providerRef: event.providerRef,
      amountMinor: event.amountMinor === undefined ? null : Number(event.amountMinor),
      raw: event.raw,
    };
    try {
      const stored = await this.prisma.webhookEvent.create({
        data: {
          provider,
          eventId: event.eventId,
          eventType: event.type,
          payload: payload as unknown as Prisma.InputJsonValue,
          signatureOk: true,
        },
      });
      await this.queue.add(
        FINANCE_JOBS.PROCESS_WEBHOOK,
        { webhookEventId: stored.id },
        { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      );
      return { received: true, duplicate: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        return { received: true, duplicate: true };
      throw err;
    }
  }

  /** Queue worker entry: applies a stored provider event to its payment/refund, exactly once. */
  async processWebhook(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!event) throw AppException.notFound('Webhook event', webhookEventId);
    if (event.processedAt) return;

    const payload = (event.payload ?? {}) as unknown as StoredWebhookPayload;
    try {
      switch (event.eventType) {
        case 'payment.captured':
          await this.applyCapturedWebhook(payload);
          break;
        case 'payment.failed':
          await this.applyFailedWebhook(payload);
          break;
        case 'refund.processed':
        case 'refund.failed':
          await this.applyRefundWebhook(event.eventType, payload);
          break;
        default:
          this.logger.warn({ webhookEventId, type: event.eventType }, 'unhandled webhook type');
      }
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
    } catch (err) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          attempts: { increment: 1 },
          lastError: (err instanceof Error ? err.message : 'processing failed').slice(0, 500),
        },
      });
      throw err;
    }
  }

  private async findPaymentByRef(providerRef: string | null): Promise<PaymentRow | null> {
    if (!providerRef) return null;
    return this.prisma.payment.findFirst({
      where: { providerRef },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async applyCapturedWebhook(payload: StoredWebhookPayload): Promise<void> {
    const payment = await this.findPaymentByRef(payload.providerRef);
    if (!payment) {
      this.logger.warn(
        { providerRef: payload.providerRef },
        'webhook references an unknown payment',
      );
      return;
    }
    if (payment.status === PaymentStatus.CAPTURED) return;
    const job = await this.prisma.job.findUnique({
      where: { id: payment.jobId },
      select: captureJobSelect,
    });
    if (!job) throw AppException.notFound('Job', payment.jobId);
    const amountMinor =
      payload.amountMinor !== null
        ? BigInt(payload.amountMinor)
        : (job.finalTotalMinor ?? payment.amountMinor);
    await this.completeCapture(
      job,
      payment,
      amountMinor,
      payment.providerRef ?? payload.providerRef,
    );
  }

  private async applyFailedWebhook(payload: StoredWebhookPayload): Promise<void> {
    const payment = await this.findPaymentByRef(payload.providerRef);
    if (!payment) return;
    if (payment.status === PaymentStatus.CAPTURED) return;
    const job = await this.prisma.job.findUnique({
      where: { id: payment.jobId },
      select: captureJobSelect,
    });
    if (!job) throw AppException.notFound('Job', payment.jobId);
    await this.markFailed(
      job,
      payment,
      'provider_failed',
      'The provider reported a failed payment',
      payload.providerRef,
    );
  }

  private async applyRefundWebhook(type: string, payload: StoredWebhookPayload): Promise<void> {
    if (!payload.providerRef) return;
    const refund = await this.prisma.refund.findFirst({
      where: { providerRef: payload.providerRef },
      orderBy: { createdAt: 'desc' },
    });
    if (!refund) {
      this.logger.warn(
        { providerRef: payload.providerRef },
        'webhook references an unknown refund',
      );
      return;
    }
    if (type === 'refund.processed') {
      if (refund.status === RefundStatus.PROCESSED) return;
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.PROCESSED, processedAt: new Date() },
      });
      return;
    }
    if (refund.status === RefundStatus.FAILED) return;
    await this.prisma.refund.update({
      where: { id: refund.id },
      data: { status: RefundStatus.FAILED, failureReason: 'The provider reported a failed refund' },
    });
  }

  /* --------------------------------------------------------------- mapping */

  toDto(payment: PaymentRow): PaymentDto {
    return {
      id: payment.id,
      jobId: payment.jobId,
      method: payment.method,
      status: payment.status,
      amount: toMoney(payment.amountMinor, payment.currency),
      capturedAmount: toMoney(payment.capturedMinor, payment.currency),
      refundedAmount: toMoney(payment.refundedMinor, payment.currency),
      providerRef: payment.providerRef,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  toRefundDto(refund: Refund, jobId: string): RefundDto {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      jobId,
      disputeId: refund.disputeId,
      status: refund.status,
      amount: toMoney(refund.amountMinor, refund.currency),
      reason: refund.reason,
      issuedById: refund.issuedById,
      providerRef: refund.providerRef,
      failureReason: refund.failureReason,
      processedAt: refund.processedAt ? refund.processedAt.toISOString() : null,
      createdAt: refund.createdAt.toISOString(),
    };
  }
}
