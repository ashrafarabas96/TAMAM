import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ErrorCode,
  type JobType,
  LedgerAccountType,
  LedgerEntryDirection,
  type LedgerEntryDto,
  type LedgerTransactionType,
  type Money,
  type Page,
  PaymentMethod,
  type WalletIntegrityDto,
  WalletOwnerType,
} from '@tamam/shared-types';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { percentOf, toMoney } from '../../common/utils/money';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { CommissionService } from './commission.service';
import {
  assertBalanced,
  assertSupportedCurrency,
  platformAccountCode,
  settlementEntries,
  walletAccountCode,
} from './domain/ledger.rules';

// Declared in @tamam/shared-types so the console and the mobile apps read the same
// shape; re-exported for the modules that already import it from this service.
export type { WalletIntegrityDto } from '@tamam/shared-types';

export const LedgerEvents = { JOB_SETTLED: 'ledger.job_settled' } as const;

export interface JobSettledEvent {
  jobId: string;
  transactionId: string;
  currency: string;
  grossFareMinor: bigint;
  commissionMinor: bigint;
  partnerNetMinor: bigint;
  partnerId: string;
  customerId: string;
}

export interface LedgerPostEntry {
  /** Platform account code (`PLATFORM_REVENUE:ILS`). Mutually exclusive with `walletId`. */
  accountCode?: string;
  walletId?: string;
  direction: LedgerEntryDirection;
  amountMinor: bigint;
}

export interface LedgerPostInput {
  type: LedgerTransactionType;
  currency: string;
  entries: LedgerPostEntry[];
  jobId?: string;
  paymentId?: string;
  refundId?: string;
  withdrawalId?: string;
  disputeId?: string;
  reference?: string;
  description: string;
  reason?: string;
  actorId?: string;
  /** Unique per business operation — replaying returns the stored transaction untouched. */
  idempotencyKey: string;
}

export type LedgerTransactionRecord = Prisma.LedgerTransactionGetPayload<{
  include: { entries: true };
}>;

export interface LedgerAccountDto {
  id: string;
  type: LedgerAccountType;
  code: string;
  currency: string;
  walletId: string | null;
  balance: Money;
  createdAt: string;
}

export interface LedgerTransactionDto {
  id: string;
  type: LedgerTransactionType;
  currency: string;
  jobId: string | null;
  paymentId: string | null;
  refundId: string | null;
  withdrawalId: string | null;
  disputeId: string | null;
  reference: string | null;
  description: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
  entries: Array<{
    id: string;
    accountId: string;
    accountCode: string;
    direction: LedgerEntryDirection;
    amount: Money;
    balanceAfter: Money;
  }>;
}

export interface LedgerTransactionFilter {
  jobId?: string;
  type?: LedgerTransactionType;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}

interface ResolvedEntry {
  accountId: string;
  accountCode: string;
  walletId: string | null;
  direction: LedgerEntryDirection;
  amountMinor: bigint;
}

/**
 * Double-entry ledger (spec §56). Every money movement in TAMAM lands here: nothing else may
 * write `wallets.balance_minor` (a database trigger rejects it unless this service's transaction
 * flag is set), and `ledger_transactions` / `ledger_entries` are append-only.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commission: CommissionService,
    @Inject(forwardRef(() => WalletService)) private readonly wallets: WalletService,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {}

  private get transactionsModel(): PrismaClient['ledgerTransaction'] {
    return this.prisma.ledgerTransaction;
  }

  /* ------------------------------------------------------------- accounts */

  /**
   * Chart-of-accounts lookup. Platform accounts are keyed `<TYPE>:<CURRENCY>`, wallet accounts
   * `WALLET:<walletId>` — both created on first use so no seeding step is required.
   */
  async getOrCreateAccount(
    type: LedgerAccountType,
    currency: string,
    walletId?: string,
    tx?: Tx,
  ): Promise<{ id: string; code: string; currency: string }> {
    assertSupportedCurrency(currency);
    const client = tx ?? this.prisma;
    const code = walletId ? walletAccountCode(walletId) : platformAccountCode(type, currency);
    const existing = await client.ledgerAccount.findUnique({
      where: { code },
      select: { id: true, code: true, currency: true },
    });
    if (existing) return existing;
    try {
      return await client.ledgerAccount.create({
        data: { type, code, currency, walletId: walletId ?? null },
        select: { id: true, code: true, currency: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Another transaction created the same account first — read it back.
        const raced = await client.ledgerAccount.findUnique({
          where: { code },
          select: { id: true, code: true, currency: true },
        });
        if (raced) return raced;
      }
      throw err;
    }
  }

  async listAccounts(
    filter: { currency?: string; type?: LedgerAccountType } = {},
  ): Promise<LedgerAccountDto[]> {
    const rows = await this.prisma.ledgerAccount.findMany({
      where: { currency: filter.currency, type: filter.type },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      take: 500,
    });
    const balances = await this.balancesFor(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      code: r.code,
      currency: r.currency,
      walletId: r.walletId,
      balance: toMoney(balances.get(r.id) ?? 0n, r.currency),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /* ---------------------------------------------------------------- posting */

  /**
   * Writes one balanced transaction. Runs inside `prisma.ledgerTransaction` when no `tx` is
   * supplied; when a `tx` is passed the caller must already own a transaction (the ledger write
   * flag is set here either way). Idempotent on `idempotencyKey`.
   */
  async post(input: LedgerPostInput, tx?: Tx): Promise<LedgerTransactionRecord> {
    if (tx) return this.postInTx(input, tx);
    return this.prisma.withLedgerWrite((t) => this.postInTx(input, t));
  }

  private async postInTx(input: LedgerPostInput, tx: Tx): Promise<LedgerTransactionRecord> {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { entries: true },
    });
    if (existing) return existing;

    assertSupportedCurrency(input.currency);
    assertBalanced(input.entries);
    // Wallet balance caches are refreshed below; the guard trigger only accepts them with this flag.
    await tx.$executeRawUnsafe(`SET LOCAL tamam.ledger_write = 'on'`);

    const resolved = await this.resolveEntries(input.entries, input.currency, tx);
    const accountIds = [...new Set(resolved.map((e) => e.accountId))].sort();
    const balances = await this.lockAndReadBalances(accountIds, tx);

    let transaction: { id: string };
    try {
      transaction = await tx.ledgerTransaction.create({
        data: {
          type: input.type,
          currency: input.currency,
          jobId: input.jobId ?? null,
          paymentId: input.paymentId ?? null,
          refundId: input.refundId ?? null,
          withdrawalId: input.withdrawalId ?? null,
          disputeId: input.disputeId ?? null,
          reference: input.reference ?? null,
          description: input.description.slice(0, 300),
          reason: input.reason ? input.reason.slice(0, 500) : null,
          actorId: input.actorId ?? null,
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });
        if (raced) return raced;
      }
      throw err;
    }

    const rows = resolved.map((entry) => {
      const before = balances.get(entry.accountId) ?? 0n;
      const after =
        entry.direction === LedgerEntryDirection.CREDIT
          ? before + entry.amountMinor
          : before - entry.amountMinor;
      balances.set(entry.accountId, after);
      return {
        transactionId: transaction.id,
        accountId: entry.accountId,
        direction: entry.direction,
        amountMinor: entry.amountMinor,
        balanceAfterMinor: after,
      };
    });
    await tx.ledgerEntry.createMany({ data: rows });

    for (const entry of resolved) {
      if (!entry.walletId) continue;
      await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balanceMinor: balances.get(entry.accountId) ?? 0n },
      });
    }

    this.logger.debug(
      { transactionId: transaction.id, type: input.type, entries: rows.length },
      'ledger transaction posted',
    );
    return tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: transaction.id },
      include: { entries: true },
    });
  }

  private async resolveEntries(
    entries: LedgerPostEntry[],
    currency: string,
    tx: Tx,
  ): Promise<ResolvedEntry[]> {
    const resolved: ResolvedEntry[] = [];
    const cache = new Map<string, { id: string; code: string }>();
    for (const entry of entries) {
      const code = entry.walletId ? walletAccountCode(entry.walletId) : entry.accountCode;
      if (!code)
        throw AppException.validation([
          { field: 'entries', message: 'entry needs accountCode or walletId' },
        ]);
      const cached = cache.get(code);
      if (cached) {
        resolved.push({
          accountId: cached.id,
          accountCode: cached.code,
          walletId: this.walletIdFromCode(code),
          direction: entry.direction,
          amountMinor: entry.amountMinor,
        });
        continue;
      }
      const account = await this.accountForCode(code, currency, tx);
      cache.set(code, account);
      resolved.push({
        accountId: account.id,
        accountCode: account.code,
        walletId: this.walletIdFromCode(code),
        direction: entry.direction,
        amountMinor: entry.amountMinor,
      });
    }
    return resolved;
  }

  private walletIdFromCode(code: string): string | null {
    return code.startsWith('WALLET:') ? code.slice('WALLET:'.length) : null;
  }

  /** Resolves (creating if needed) the account behind a code, inferring the account type from it. */
  private async accountForCode(
    code: string,
    currency: string,
    tx: Tx,
  ): Promise<{ id: string; code: string }> {
    const walletId = this.walletIdFromCode(code);
    if (walletId) {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        select: { id: true, ownerType: true, currency: true },
      });
      if (!wallet) throw AppException.notFound('Wallet', walletId);
      if (wallet.currency !== currency) {
        throw AppException.validation([
          {
            field: 'entries',
            message: `wallet ${walletId} holds ${wallet.currency}, transaction is ${currency}`,
          },
        ]);
      }
      const type =
        wallet.ownerType === WalletOwnerType.PARTNER
          ? LedgerAccountType.PARTNER_WALLET
          : LedgerAccountType.CUSTOMER_WALLET;
      return this.getOrCreateAccount(type, currency, walletId, tx);
    }
    const [typePart, currencyPart] = code.split(':');
    const accountType = Object.values(LedgerAccountType).find((t) => t === typePart);
    if (!accountType || !currencyPart) {
      throw AppException.validation([
        { field: 'entries', message: `unknown ledger account code ${code}` },
      ]);
    }
    if (currencyPart !== currency) {
      throw AppException.validation([
        {
          field: 'entries',
          message: `account ${code} does not match transaction currency ${currency}`,
        },
      ]);
    }
    return this.getOrCreateAccount(accountType, currencyPart, undefined, tx);
  }

  /**
   * Locks the touched accounts (deterministic order → no deadlocks) and returns their current
   * balances derived from the entries, so `balance_after_minor` is a true running balance.
   */
  private async lockAndReadBalances(accountIds: string[], tx: Tx): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>();
    if (!accountIds.length) return map;
    const rows = await tx.$queryRaw<Array<{ id: string; balance: bigint }>>`
      SELECT id, tamam_ledger_balance(id) AS balance
      FROM ledger_accounts
      WHERE id = ANY(ARRAY[${Prisma.join(accountIds)}]::uuid[])
      ORDER BY id
      FOR UPDATE`;
    for (const row of rows) map.set(row.id, BigInt(row.balance));
    return map;
  }

  private async balancesFor(accountIds: string[]): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>();
    if (!accountIds.length) return map;
    const rows = await this.prisma.$queryRaw<Array<{ id: string; balance: bigint }>>`
      SELECT id, tamam_ledger_balance(id) AS balance
      FROM ledger_accounts
      WHERE id = ANY(ARRAY[${Prisma.join(accountIds)}]::uuid[])`;
    for (const row of rows) map.set(row.id, BigInt(row.balance));
    return map;
  }

  /* -------------------------------------------------------------- balances */

  /** Cached balance (wallets.balance_minor) — the value the apps see. */
  async walletBalance(walletId: string): Promise<bigint> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { balanceMinor: true },
    });
    if (!wallet) throw AppException.notFound('Wallet', walletId);
    return wallet.balanceMinor;
  }

  /** Authoritative balance recomputed from the entries via `tamam_ledger_balance` (spec §56). */
  async recomputeWalletBalance(walletId: string): Promise<bigint> {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { walletId },
      select: { id: true },
    });
    if (!account) return 0n;
    const rows = await this.prisma.$queryRaw<
      Array<{ balance: bigint }>
    >`SELECT tamam_ledger_balance(${account.id}::uuid) AS balance`;
    const balance = rows[0]?.balance;
    return balance === undefined ? 0n : BigInt(balance);
  }

  async verifyWallet(walletId: string): Promise<WalletIntegrityDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, currency: true, balanceMinor: true },
    });
    if (!wallet) throw AppException.notFound('Wallet', walletId);
    const recomputed = await this.recomputeWalletBalance(walletId);
    const matches = recomputed === wallet.balanceMinor;
    if (!matches) {
      this.logger.error(
        { walletId, cached: wallet.balanceMinor.toString(), recomputed: recomputed.toString() },
        'wallet balance cache diverged from the ledger',
      );
    }
    return {
      walletId: wallet.id,
      currency: wallet.currency,
      cachedBalance: toMoney(wallet.balanceMinor, wallet.currency),
      recomputedBalance: toMoney(recomputed, wallet.currency),
      matches,
    };
  }

  /** Throws when the cached balance and the ledger disagree — used before money leaves the platform. */
  async assertWalletIntegrity(walletId: string): Promise<void> {
    const result = await this.verifyWallet(walletId);
    if (!result.matches) {
      throw AppException.conflict(
        `Wallet ${walletId} balance does not match the ledger`,
        ErrorCode.INTERNAL_ERROR,
        {
          cached: result.cachedBalance.amount,
          recomputed: result.recomputedBalance.amount,
        },
      );
    }
  }

  /* ------------------------------------------------------------- statement */

  async statement(
    walletId: string,
    cursorRaw: string | undefined,
    limit: number,
  ): Promise<Page<LedgerEntryDto>> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, currency: true, ledgerAccount: { select: { id: true } } },
    });
    if (!wallet) throw AppException.notFound('Wallet', walletId);
    if (!wallet.ledgerAccount) return { items: [], nextCursor: null };
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { accountId: wallet.ledgerAccount.id, ...cursorWhere(cursor) },
      include: {
        transaction: { select: { id: true, type: true, description: true, jobId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (row) => ({
      id: row.id,
      transactionId: row.transactionId,
      transactionType: row.transaction.type,
      direction: row.direction,
      amount: toMoney(row.amountMinor, wallet.currency),
      balanceAfter: toMoney(row.balanceAfterMinor, wallet.currency),
      description: row.transaction.description,
      jobId: row.transaction.jobId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listTransactions(filter: LedgerTransactionFilter): Promise<Page<LedgerTransactionDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.transactionsModel.findMany({
      where: {
        ...cursorWhere(cursor),
        jobId: filter.jobId,
        type: filter.type,
        createdAt:
          filter.from || filter.to
            ? {
                gte: filter.from ? new Date(filter.from) : undefined,
                lte: filter.to ? new Date(filter.to) : undefined,
              }
            : undefined,
      },
      include: { entries: { include: { account: { select: { code: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (t) => ({
      id: t.id,
      type: t.type,
      currency: t.currency,
      jobId: t.jobId,
      paymentId: t.paymentId,
      refundId: t.refundId,
      withdrawalId: t.withdrawalId,
      disputeId: t.disputeId,
      reference: t.reference,
      description: t.description,
      reason: t.reason,
      actorId: t.actorId,
      createdAt: t.createdAt.toISOString(),
      entries: t.entries.map((e) => ({
        id: e.id,
        accountId: e.accountId,
        accountCode: e.account.code,
        direction: e.direction,
        amount: toMoney(e.amountMinor, t.currency),
        balanceAfter: toMoney(e.balanceAfterMinor, t.currency),
      })),
    }));
  }

  /* -------------------------------------------------------------- settlement */

  /**
   * Settles a job: commission from the frozen pricing snapshot (or the policy when the job has
   * none), promo discount funded by the platform, cancellation fee split with the partner.
   * Idempotent on `settle:<jobId>` — replaying returns the existing transaction.
   */
  async settleJob(jobId: string, tx?: Tx): Promise<LedgerTransactionRecord | null> {
    if (tx) return this.settleJobInTx(jobId, tx);
    return this.prisma.withLedgerWrite((t) => this.settleJobInTx(jobId, t));
  }

  private async settleJobInTx(jobId: string, tx: Tx): Promise<LedgerTransactionRecord | null> {
    const existing = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKey: `settle:${jobId}` },
      include: { entries: true },
    });
    if (existing) return existing;

    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        number: true,
        type: true,
        currency: true,
        paymentMethod: true,
        customerId: true,
        partnerId: true,
        categoryId: true,
        zoneId: true,
        estimatedTotalMinor: true,
        finalTotalMinor: true,
        promoDiscountMinor: true,
        cancellationFeeMinor: true,
        completedAt: true,
        pricingSnapshot: { select: { commissionPercent: true, commissionFixedMinor: true } },
      },
    });
    if (!job) throw AppException.notFound('Job', jobId);

    const currency = job.currency;
    const jobTotalMinor = job.finalTotalMinor ?? job.estimatedTotalMinor ?? 0n;
    const promoDiscountMinor = job.promoDiscountMinor;
    const cancellationFeeMinor = job.cancellationFeeMinor;
    if (jobTotalMinor <= 0n && promoDiscountMinor <= 0n && cancellationFeeMinor <= 0n) return null;
    if (!job.partnerId)
      throw AppException.conflict('Job has no partner to settle against', ErrorCode.CONFLICT);

    const grossFareMinor = jobTotalMinor + promoDiscountMinor;
    const commissionMinor = await this.commissionFor(job, grossFareMinor, tx);

    const partnerWallet = await this.wallets.getOrCreate(
      WalletOwnerType.PARTNER,
      job.partnerId,
      currency,
      tx,
    );
    const needsCustomerWallet =
      (job.paymentMethod === PaymentMethod.WALLET && jobTotalMinor > 0n) ||
      (cancellationFeeMinor > 0n &&
        (job.paymentMethod === PaymentMethod.CASH || job.paymentMethod === PaymentMethod.WALLET));
    const customerWallet = needsCustomerWallet
      ? await this.wallets.getOrCreate(WalletOwnerType.CUSTOMER, job.customerId, currency, tx)
      : null;

    const plan = settlementEntries({
      jobTotalMinor,
      commissionMinor,
      paymentMethod: job.paymentMethod,
      promoDiscountMinor,
      cancellationFeeMinor,
      partnerFeeOnCancelMinor:
        cancellationFeeMinor > 0n
          ? await this.partnerCancellationCompensation(job.type, job.zoneId, currency, tx)
          : 0n,
      currency,
      partnerWalletAccountCode: walletAccountCode(partnerWallet.id),
      customerWalletAccountCode: customerWallet ? walletAccountCode(customerWallet.id) : undefined,
    });
    if (!plan.entries.length) return null;

    const transaction = await this.postInTx(
      {
        type: plan.type,
        currency,
        entries: plan.entries,
        jobId: job.id,
        reference: job.number,
        description: `Settlement for job ${job.number}`,
        idempotencyKey: `settle:${job.id}`,
      },
      tx,
    );

    this.events.emit(LedgerEvents.JOB_SETTLED, {
      jobId: job.id,
      transactionId: transaction.id,
      currency,
      grossFareMinor: plan.grossFareMinor,
      commissionMinor: plan.commissionMinor,
      partnerNetMinor: plan.partnerNetMinor,
      partnerId: job.partnerId,
      customerId: job.customerId,
    } satisfies JobSettledEvent);

    return transaction;
  }

  /** Commission comes from the immutable pricing snapshot when the job has one (spec §49). */
  private async commissionFor(
    job: {
      type: JobType;
      categoryId: string | null;
      zoneId: string;
      partnerId: string | null;
      completedAt: Date | null;
      pricingSnapshot: { commissionPercent: Prisma.Decimal; commissionFixedMinor: bigint } | null;
    },
    grossFareMinor: bigint,
    tx: Tx,
  ): Promise<bigint> {
    if (job.pricingSnapshot) {
      return (
        percentOf(grossFareMinor, job.pricingSnapshot.commissionPercent.toNumber()) +
        job.pricingSnapshot.commissionFixedMinor
      );
    }
    const resolved = await this.commission.resolve(
      {
        jobType: job.type,
        categoryId: job.categoryId,
        zoneId: job.zoneId,
        partnerId: job.partnerId,
        at: job.completedAt ?? new Date(),
      },
      tx,
    );
    return percentOf(grossFareMinor, resolved.percent) + resolved.fixedMinor;
  }

  /** Most specific active cancellation policy decides what the partner keeps of the fee. */
  private async partnerCancellationCompensation(
    jobType: JobType,
    zoneId: string,
    currency: string,
    tx: Tx,
  ): Promise<bigint> {
    const policies = await tx.cancellationPolicy.findMany({
      where: {
        isActive: true,
        currency,
        OR: [{ jobType }, { jobType: null }],
        AND: [{ OR: [{ zoneId }, { zoneId: null }] }],
      },
    });
    let best: { score: number; value: bigint } | null = null;
    for (const policy of policies) {
      const score = (policy.jobType === jobType ? 2 : 0) + (policy.zoneId === zoneId ? 1 : 0);
      if (!best || score > best.score) best = { score, value: policy.partnerFeeOnCancelMinor };
    }
    return best?.value ?? 0n;
  }
}
