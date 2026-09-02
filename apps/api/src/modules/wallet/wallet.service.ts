import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma, type PrismaClient, type Wallet } from '@prisma/client';
import {
  CONFIG_KEYS,
  ErrorCode,
  FEATURE_FLAGS,
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  type LedgerEntryDto,
  type Money,
  type Page,
  type PartnerEarningsDto,
  type WalletDto,
  WalletOwnerType,
  WithdrawalStatus,
} from '@tamam/shared-types';
import type { TopUpWalletInput, WalletAdjustmentInput, WithdrawalDecisionInput, WithdrawalRequestInput } from '@tamam/validation';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { toMoney } from '../../common/utils/money';
import { startOfUtcDay } from '../../common/utils/time';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { PAYMENT_GATEWAY, type PaymentGatewayProvider } from '../../infrastructure/providers/payment-gateway/payment-gateway.provider';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';
import { platformAccountCode } from '../ledger/domain/ledger.rules';
import { LedgerService } from '../ledger/ledger.service';
import { MetricsService } from '../metrics/metrics.service';

export type WalletOwner = 'CUSTOMER' | 'PARTNER';

export interface WalletTopUpResultDto {
  status: 'CAPTURED' | 'REQUIRES_ACTION' | 'FAILED';
  /** 3-D Secure / redirect URL the app must open when status is REQUIRES_ACTION. */
  actionUrl: string | null;
  providerRef: string | null;
  wallet: WalletDto;
}

export interface WithdrawalDto {
  id: string;
  partnerId: string;
  bankAccountId: string;
  bankName: string;
  ibanLast4: string;
  status: WithdrawalStatus;
  amount: Money;
  fee: Money;
  decisionReason: string | null;
  providerReference: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface WithdrawalFilter {
  status?: WithdrawalStatus;
  partnerId?: string;
  cursor?: string;
  limit: number;
}

export type EarningsPeriod = 'today' | 'week' | 'month';

const withdrawalInclude = { bankAccount: { select: { bankName: true, ibanLast4: true } } } satisfies Prisma.WithdrawalInclude;
type WithdrawalRow = Prisma.WithdrawalGetPayload<{ include: typeof withdrawalInclude }>;

/** Short, stable suffix so idempotency keys stay inside the column width. */
const digest = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 32);

/**
 * Wallets for customers and partners (spec §55, §144). Balances are **never** written here —
 * every movement goes through `LedgerService`, which owns the only path the database trigger
 * accepts. This service owns wallet lifecycle, top-ups, admin adjustments and withdrawals.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LedgerService)) private readonly ledger: LedgerService,
    private readonly config: SystemConfigService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayProvider,
  ) {}

  /* -------------------------------------------------------------- lifecycle */

  /** Idempotent wallet lookup/creation; also materialises the matching ledger account. */
  async getOrCreate(ownerType: WalletOwner, ownerId: string, currency: string, tx?: Tx): Promise<Wallet> {
    const client = tx ?? this.prisma;
    const where = ownerType === 'PARTNER' ? { partnerId: ownerId } : { customerId: ownerId };
    const existing = await client.wallet.findUnique({ where });
    if (existing) {
      if (existing.currency !== currency) {
        throw AppException.conflict(`Wallet ${existing.id} holds ${existing.currency}; ${currency} was requested`, ErrorCode.VALIDATION_FAILED);
      }
      await this.ensureAccount(existing, tx);
      return existing;
    }

    const profileExists =
      ownerType === 'PARTNER'
        ? await client.partnerProfile.findUnique({ where: { userId: ownerId }, select: { userId: true } })
        : await client.customerProfile.findUnique({ where: { userId: ownerId }, select: { userId: true } });
    if (!profileExists) throw AppException.notFound(ownerType === 'PARTNER' ? 'Partner profile' : 'Customer profile', ownerId);

    try {
      const created = await client.wallet.create({
        data: {
          ownerType: ownerType === 'PARTNER' ? WalletOwnerType.PARTNER : WalletOwnerType.CUSTOMER,
          partnerId: ownerType === 'PARTNER' ? ownerId : null,
          customerId: ownerType === 'CUSTOMER' ? ownerId : null,
          currency,
        },
      });
      await this.ensureAccount(created, tx);
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await client.wallet.findUnique({ where });
        if (raced) {
          await this.ensureAccount(raced, tx);
          return raced;
        }
      }
      throw err;
    }
  }

  private async ensureAccount(wallet: Wallet, tx?: Tx): Promise<void> {
    const type = wallet.ownerType === WalletOwnerType.PARTNER ? LedgerAccountType.PARTNER_WALLET : LedgerAccountType.CUSTOMER_WALLET;
    await this.ledger.getOrCreateAccount(type, wallet.currency, wallet.id, tx);
  }

  /**
   * The wallet behind `GET /wallet`. Partners default to their earnings wallet; a partner who is
   * also a customer can ask for the other one explicitly (`?owner=CUSTOMER`).
   */
  async resolveOwnWallet(user: RequestUser, ownerType?: WalletOwner): Promise<Wallet> {
    const owner: WalletOwner = ownerType ?? (user.partnerId ? 'PARTNER' : 'CUSTOMER');
    if (owner === 'PARTNER' && !user.partnerId) throw AppException.notFound('Partner profile', user.id);
    if (owner === 'CUSTOMER' && !user.customerId) throw AppException.notFound('Customer profile', user.id);
    const row = await this.prisma.user.findUnique({ where: { id: user.id }, select: { currency: true } });
    if (!row) throw AppException.notFound('User', user.id);
    return this.getOrCreate(owner, user.id, row.currency);
  }

  async getMine(user: RequestUser, ownerType?: WalletOwner): Promise<WalletDto> {
    return this.toDto(await this.resolveOwnWallet(user, ownerType));
  }

  async statement(user: RequestUser, cursor: string | undefined, limit: number, ownerType?: WalletOwner): Promise<Page<LedgerEntryDto>> {
    const wallet = await this.resolveOwnWallet(user, ownerType);
    return this.ledger.statement(wallet.id, cursor, limit);
  }

  /* ----------------------------------------------------------------- top-up */

  /**
   * Charges the configured gateway and credits the wallet when the charge captures. Wallet
   * top-ups are not tied to a job, so they carry no `payments` row (that table is job-scoped) —
   * the provider reference lives on the ledger transaction instead.
   */
  async topUp(user: RequestUser, input: TopUpWalletInput, idempotencyKey: string, ownerType?: WalletOwner): Promise<WalletTopUpResultDto> {
    if (input.method !== 'BANK') await this.config.assertEnabled(FEATURE_FLAGS.CARD_PAYMENTS, { userId: user.id });
    const wallet = await this.resolveOwnWallet(user, ownerType);
    if (wallet.isFrozen) throw AppException.conflict('This wallet is frozen', ErrorCode.FORBIDDEN);
    if (input.amount.currency !== wallet.currency) {
      throw AppException.validation([{ field: 'amount.currency', message: `wallet holds ${wallet.currency}` }]);
    }
    const amountMinor = BigInt(input.amount.amount);
    if (amountMinor <= 0n) throw AppException.validation([{ field: 'amount.amount', message: 'top-up must be positive' }]);

    const ledgerKey = `topup:${wallet.id}:${digest(idempotencyKey)}`;
    const transactionsModel = this.prisma.ledgerTransaction;
    const already = await transactionsModel.findUnique({ where: { idempotencyKey: ledgerKey }, select: { reference: true } });
    if (already) {
      return { status: 'CAPTURED', actionUrl: null, providerRef: already.reference, wallet: this.toDto(await this.reload(wallet.id)) };
    }

    const operationId = randomUUID();
    const result = await this.gateway.authorize({
      paymentId: operationId,
      amountMinor,
      currency: wallet.currency,
      customerId: user.id,
      description: `Wallet top-up ${wallet.id}`,
      idempotencyKey: ledgerKey,
      returnUrl: input.returnUrl,
    });

    if (result.status === 'REQUIRES_ACTION') {
      return { status: 'REQUIRES_ACTION', actionUrl: result.actionUrl ?? null, providerRef: result.providerRef, wallet: this.toDto(wallet) };
    }
    if (result.status === 'FAILED') {
      this.metrics.paymentFailures.inc({ method: input.method, code: result.failureCode ?? 'gateway_failed' });
      throw AppException.badRequest(ErrorCode.PAYMENT_FAILED, result.failureMessage ?? 'Top-up was declined');
    }

    const captured = result.status === 'CAPTURED' ? result : await this.gateway.capture(result.providerRef ?? operationId, amountMinor, ledgerKey);
    if (captured.status !== 'CAPTURED') {
      this.metrics.paymentFailures.inc({ method: input.method, code: captured.failureCode ?? 'capture_failed' });
      throw AppException.badRequest(ErrorCode.PAYMENT_FAILED, captured.failureMessage ?? 'Top-up capture failed');
    }

    await this.ledger.post({
      type: LedgerTransactionType.WALLET_TOPUP,
      currency: wallet.currency,
      entries: [
        { accountCode: platformAccountCode(LedgerAccountType.PLATFORM_GATEWAY_CLEARING, wallet.currency), direction: LedgerEntryDirection.DEBIT, amountMinor },
        { walletId: wallet.id, direction: LedgerEntryDirection.CREDIT, amountMinor },
      ],
      reference: captured.providerRef ?? operationId,
      description: `Wallet top-up via ${this.gateway.name}`,
      actorId: user.id,
      idempotencyKey: ledgerKey,
    });

    return { status: 'CAPTURED', actionUrl: null, providerRef: captured.providerRef, wallet: this.toDto(await this.reload(wallet.id)) };
  }

  /* ------------------------------------------------------------- adjustment */

  /**
   * Manual finance adjustment (spec §144). Reason and reference are mandatory, the counter
   * account is `PLATFORM_PAYABLES`, and the audit entry is written inside the same transaction
   * so an unaudited adjustment can never exist.
   */
  async adjust(input: WalletAdjustmentInput, actor: RequestUser, requestId: string | null): Promise<WalletDto> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: input.walletId } });
    if (!wallet) throw AppException.notFound('Wallet', input.walletId);
    const amountMinor = BigInt(Math.abs(input.amountMinor));
    if (amountMinor === 0n) throw AppException.validation([{ field: 'amountMinor', message: 'amount cannot be zero' }]);
    const isCredit = input.amountMinor > 0;
    const payables = platformAccountCode(LedgerAccountType.PLATFORM_PAYABLES, wallet.currency);

    await this.prisma.withLedgerWrite(async (tx) => {
      await this.ledger.post(
        {
          type: LedgerTransactionType.MANUAL_ADJUSTMENT,
          currency: wallet.currency,
          entries: isCredit
            ? [
                { accountCode: payables, direction: LedgerEntryDirection.DEBIT, amountMinor },
                { walletId: wallet.id, direction: LedgerEntryDirection.CREDIT, amountMinor },
              ]
            : [
                { walletId: wallet.id, direction: LedgerEntryDirection.DEBIT, amountMinor },
                { accountCode: payables, direction: LedgerEntryDirection.CREDIT, amountMinor },
              ],
          reference: input.reference,
          description: `Manual adjustment ${isCredit ? '+' : '-'}${amountMinor} ${wallet.currency}`,
          reason: input.reason,
          actorId: actor.id,
          idempotencyKey: `adjust:${wallet.id}:${digest(`${input.reference}:${input.amountMinor}`)}`,
        },
        tx,
      );
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'wallet.adjust',
          entity: 'wallet',
          entityId: wallet.id,
          oldValue: { balanceMinor: wallet.balanceMinor.toString() },
          newValue: { amountMinor: input.amountMinor, reference: input.reference },
          reason: input.reason,
          requestId,
        },
        tx,
      );
    });

    return this.toDto(await this.reload(wallet.id));
  }

  /* ------------------------------------------------------------ withdrawals */

  /**
   * Partner payout request (spec §55). The amount is held immediately — debited from the wallet
   * and credited to `PLATFORM_PAYABLES` — so it cannot be spent while finance reviews it.
   */
  async requestWithdrawal(user: RequestUser, input: WithdrawalRequestInput, idempotencyKey: string): Promise<WithdrawalDto> {
    if (!user.partnerId) throw AppException.forbidden('Only partners can withdraw');
    const wallet = await this.resolveOwnWallet(user, 'PARTNER');
    if (wallet.isFrozen) throw AppException.conflict('This wallet is frozen', ErrorCode.FORBIDDEN);

    const key = `withdraw:${user.id}:${digest(idempotencyKey)}`;
    const replay = await this.prisma.withdrawal.findUnique({ where: { idempotencyKey: key }, include: withdrawalInclude });
    if (replay) return this.toWithdrawalDto(replay);

    const bankAccount = await this.prisma.partnerBankAccount.findFirst({ where: { id: input.bankAccountId, partnerId: user.id } });
    if (!bankAccount) throw AppException.notFound('Bank account', input.bankAccountId);

    const amountMinor = BigInt(input.amountMinor);
    const minimum = BigInt(Math.trunc(await this.config.getNumber(CONFIG_KEYS.WALLET_MIN_WITHDRAWAL_MINOR)));
    if (amountMinor < minimum) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, `Minimum withdrawal is ${minimum} ${wallet.currency} minor units`);
    }
    await this.ledger.assertWalletIntegrity(wallet.id);
    const balance = await this.ledger.walletBalance(wallet.id);
    if (balance < amountMinor) throw AppException.badRequest(ErrorCode.INSUFFICIENT_WALLET_BALANCE, 'Your balance is lower than the requested amount');

    const row = await this.prisma.withLedgerWrite(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: { partnerId: user.id, bankAccountId: bankAccount.id, currency: wallet.currency, amountMinor, idempotencyKey: key },
        include: withdrawalInclude,
      });
      await this.ledger.post(
        {
          type: LedgerTransactionType.WALLET_WITHDRAWAL,
          currency: wallet.currency,
          entries: [
            { walletId: wallet.id, direction: LedgerEntryDirection.DEBIT, amountMinor },
            { accountCode: platformAccountCode(LedgerAccountType.PLATFORM_PAYABLES, wallet.currency), direction: LedgerEntryDirection.CREDIT, amountMinor },
          ],
          withdrawalId: withdrawal.id,
          reference: withdrawal.id,
          description: `Withdrawal hold for partner ${user.id}`,
          actorId: user.id,
          idempotencyKey: `withdrawal:${withdrawal.id}:hold`,
        },
        tx,
      );
      return withdrawal;
    });

    this.logger.info({ withdrawalId: row.id, partnerId: user.id }, 'withdrawal requested');
    return this.toWithdrawalDto(row);
  }

  /** APPROVE keeps the hold, REJECT reverses it, MARK_PAID records the bank transfer reference. */
  async decideWithdrawal(id: string, input: WithdrawalDecisionInput, actor: RequestUser, requestId: string | null): Promise<WithdrawalDto> {
    const current = await this.prisma.withdrawal.findUnique({ where: { id }, include: withdrawalInclude });
    if (!current) throw AppException.notFound('Withdrawal', id);

    const allowed: Record<WithdrawalDecisionInput['decision'], WithdrawalStatus[]> = {
      APPROVE: [WithdrawalStatus.REQUESTED],
      REJECT: [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED],
      MARK_PAID: [WithdrawalStatus.APPROVED],
    };
    if (!allowed[input.decision].includes(current.status)) {
      throw AppException.invalidTransition(current.status, input.decision);
    }
    if (input.decision === 'MARK_PAID' && !input.providerReference) {
      throw AppException.validation([{ field: 'providerReference', message: 'a bank/provider reference is required to mark a withdrawal paid' }]);
    }

    const next =
      input.decision === 'APPROVE' ? WithdrawalStatus.APPROVED : input.decision === 'REJECT' ? WithdrawalStatus.REJECTED : WithdrawalStatus.PAID;

    const row = await this.prisma.withLedgerWrite(async (tx) => {
      const updated = await tx.withdrawal.update({
        where: { id },
        data: {
          status: next,
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionReason: input.reason,
          providerReference: input.decision === 'MARK_PAID' ? (input.providerReference ?? null) : current.providerReference,
          paidAt: input.decision === 'MARK_PAID' ? new Date() : current.paidAt,
        },
        include: withdrawalInclude,
      });
      if (input.decision === 'REJECT') {
        // Give the held money back to the partner.
        const wallet = await this.getOrCreate('PARTNER', current.partnerId, current.currency, tx);
        await this.ledger.post(
          {
            type: LedgerTransactionType.WALLET_WITHDRAWAL,
            currency: current.currency,
            entries: [
              { accountCode: platformAccountCode(LedgerAccountType.PLATFORM_PAYABLES, current.currency), direction: LedgerEntryDirection.DEBIT, amountMinor: current.amountMinor },
              { walletId: wallet.id, direction: LedgerEntryDirection.CREDIT, amountMinor: current.amountMinor },
            ],
            withdrawalId: current.id,
            reference: current.id,
            description: `Withdrawal ${current.id} rejected — hold released`,
            reason: input.reason,
            actorId: actor.id,
            idempotencyKey: `withdrawal:${current.id}:reverse`,
          },
          tx,
        );
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: `withdrawal.${input.decision.toLowerCase()}`,
          entity: 'withdrawal',
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: next, providerReference: input.providerReference ?? null },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return updated;
    });

    return this.toWithdrawalDto(row);
  }

  async listWithdrawals(filter: WithdrawalFilter): Promise<Page<WithdrawalDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.withdrawal.findMany({
      where: { ...cursorWhere(cursor), status: filter.status, partnerId: filter.partnerId },
      include: withdrawalInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toWithdrawalDto(row));
  }

  /* --------------------------------------------------------------- earnings */

  /**
   * Partner earnings derived from the ledger (spec §55). Cash jobs credit the partner the whole
   * fare and immediately offset it with the cash they keep, so gross earnings are rebuilt as
   * `wallet movement + commission + cash retained`, which holds for every payment method.
   */
  async partnerEarnings(partnerId: string, period: EarningsPeriod): Promise<PartnerEarningsDto> {
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { userId: true } });
    if (!profile) throw AppException.notFound('Partner profile', partnerId);
    const user = await this.prisma.user.findUnique({ where: { id: partnerId }, select: { currency: true } });
    const wallet = await this.getOrCreate('PARTNER', partnerId, user?.currency ?? 'ILS');
    const account = await this.prisma.ledgerAccount.findUnique({ where: { walletId: wallet.id }, select: { id: true } });

    const now = new Date();
    const today = startOfUtcDay(now);
    const from = period === 'today' ? today : new Date(today.getTime() - (period === 'week' ? 6 : 29) * 86_400_000);

    const byType = new Map<string, { credit: bigint; debit: bigint }>();
    if (account) {
      const rows = await this.prisma.$queryRaw<Array<{ type: string; direction: string; total: bigint }>>`
        SELECT t.type::text AS type, e.direction::text AS direction, COALESCE(SUM(e.amount_minor), 0)::bigint AS total
        FROM ledger_entries e
        JOIN ledger_transactions t ON t.id = e.transaction_id
        WHERE e.account_id = ${account.id}::uuid AND e.created_at >= ${from} AND e.created_at <= ${now}
        GROUP BY 1, 2`;
      for (const row of rows) {
        const bucket = byType.get(row.type) ?? { credit: 0n, debit: 0n };
        if (row.direction === LedgerEntryDirection.CREDIT) bucket.credit += BigInt(row.total);
        else bucket.debit += BigInt(row.total);
        byType.set(row.type, bucket);
      }
    }
    const net = (type: LedgerTransactionType): bigint => {
      const bucket = byType.get(type);
      return bucket ? bucket.credit - bucket.debit : 0n;
    };

    const platformRows = await this.prisma.$queryRaw<Array<{ account_type: string; credits: bigint; debits: bigint }>>`
      SELECT a.type::text AS account_type,
             COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_minor ELSE 0 END), 0)::bigint AS credits,
             COALESCE(SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount_minor ELSE 0 END), 0)::bigint AS debits
      FROM ledger_entries e
      JOIN ledger_transactions t ON t.id = e.transaction_id
      JOIN ledger_accounts a ON a.id = e.account_id
      JOIN jobs j ON j.id = t.job_id
      WHERE j.partner_id = ${partnerId}::uuid
        AND a.type IN ('PLATFORM_REVENUE', 'PLATFORM_CASH_CLEARING')
        AND t.created_at >= ${from} AND t.created_at <= ${now}
      GROUP BY 1`;
    let commissionMinor = 0n;
    let cashRetainedMinor = 0n;
    for (const row of platformRows) {
      if (row.account_type === LedgerAccountType.PLATFORM_REVENUE) commissionMinor = BigInt(row.credits) - BigInt(row.debits);
      if (row.account_type === LedgerAccountType.PLATFORM_CASH_CLEARING) cashRetainedMinor = BigInt(row.credits);
    }

    const completedJobs = await this.prisma.job.count({ where: { partnerId, status: 'COMPLETED', completedAt: { gte: from, lte: now } } });

    const jobsMovement = net(LedgerTransactionType.JOB_CHARGE) + net(LedgerTransactionType.CANCELLATION_FEE);
    const bonusesMinor = net(LedgerTransactionType.BONUS) + net(LedgerTransactionType.REFERRAL_REWARD);
    const adjustmentsMinor = net(LedgerTransactionType.MANUAL_ADJUSTMENT) + net(LedgerTransactionType.DISPUTE_SETTLEMENT) + net(LedgerTransactionType.REFUND);
    const withdrawalsMinor = -net(LedgerTransactionType.WALLET_WITHDRAWAL);
    const grossMinor = jobsMovement + commissionMinor + cashRetainedMinor;
    const netMinor = grossMinor - commissionMinor + bonusesMinor + adjustmentsMinor;

    return {
      period,
      currency: wallet.currency,
      completedJobs,
      grossEarnings: toMoney(grossMinor, wallet.currency),
      commission: toMoney(commissionMinor, wallet.currency),
      bonuses: toMoney(bonusesMinor, wallet.currency),
      adjustments: toMoney(adjustmentsMinor, wallet.currency),
      netEarnings: toMoney(netMinor, wallet.currency),
      withdrawals: toMoney(withdrawalsMinor, wallet.currency),
      currentBalance: toMoney(wallet.balanceMinor, wallet.currency),
    };
  }

  /* --------------------------------------------------------------- mapping */

  private async reload(walletId: string): Promise<Wallet> {
    return this.prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  }

  toDto(wallet: Wallet): WalletDto {
    return {
      id: wallet.id,
      currency: wallet.currency,
      balance: toMoney(wallet.balanceMinor, wallet.currency),
      pendingBalance: toMoney(wallet.pendingMinor, wallet.currency),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  toWithdrawalDto(row: WithdrawalRow): WithdrawalDto {
    return {
      id: row.id,
      partnerId: row.partnerId,
      bankAccountId: row.bankAccountId,
      bankName: row.bankAccount.bankName,
      ibanLast4: row.bankAccount.ibanLast4,
      status: row.status,
      amount: toMoney(row.amountMinor, row.currency),
      fee: toMoney(row.feeMinor, row.currency),
      decisionReason: row.decisionReason,
      providerReference: row.providerReference,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
