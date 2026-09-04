import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  PaymentMethod,
} from '@tamam/shared-types';
import type { PinoLogger } from 'nestjs-pino';

import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';

import type { CommissionService } from './commission.service';
import { LedgerService } from './ledger.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const PARTNER_WALLET = '44444444-4444-4444-8444-444444444444';

interface EntryRow {
  transactionId: string;
  accountId: string;
  direction: LedgerEntryDirection;
  amountMinor: bigint;
  balanceAfterMinor: bigint;
}

interface AccountRow {
  id: string;
  code: string;
  currency: string;
  type: LedgerAccountType;
  walletId: string | null;
}

interface WalletRow {
  id: string;
  ownerType: 'CUSTOMER' | 'PARTNER';
  currency: string;
  balanceMinor: bigint;
}

function buildHarness(
  options: { job?: Record<string, unknown>; existingTransaction?: Record<string, unknown> } = {},
) {
  const accounts = new Map<string, AccountRow>();
  const wallets = new Map<string, WalletRow>([
    [
      PARTNER_WALLET,
      { id: PARTNER_WALLET, ownerType: 'PARTNER', currency: 'ILS', balanceMinor: 0n },
    ],
  ]);
  const entries: EntryRow[] = [];
  const transactions = new Map<string, Record<string, unknown>>();
  if (options.existingTransaction)
    transactions.set(
      String(options.existingTransaction.idempotencyKey),
      options.existingTransaction,
    );

  const createAccount = jest.fn(
    async ({
      data,
    }: {
      data: { code: string; currency: string; type: LedgerAccountType; walletId: string | null };
    }) => {
      const row: AccountRow = {
        id: `acc-${accounts.size + 1}`,
        code: data.code,
        currency: data.currency,
        type: data.type,
        walletId: data.walletId ?? null,
      };
      accounts.set(row.code, row);
      return row;
    },
  );

  const tx = {
    ledgerTransaction: {
      findUnique: jest.fn(
        async ({ where }: { where: { idempotencyKey: string } }) =>
          transactions.get(where.idempotencyKey) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'tx-1', entries: [], ...data };
        transactions.set(String(data.idempotencyKey), row);
        return { id: row.id };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ id: 'tx-1', entries })),
    },
    ledgerEntry: {
      createMany: jest.fn(async ({ data }: { data: EntryRow[] }) => {
        entries.push(...data);
        return { count: data.length };
      }),
    },
    ledgerAccount: {
      findUnique: jest.fn(async ({ where }: { where: { code?: string; walletId?: string } }) => {
        if (where.code) return accounts.get(where.code) ?? null;
        return [...accounts.values()].find((a) => a.walletId === where.walletId) ?? null;
      }),
      create: createAccount,
    },
    wallet: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => wallets.get(where.id) ?? null,
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { balanceMinor: bigint } }) => {
          const wallet = wallets.get(where.id);
          if (wallet) wallet.balanceMinor = data.balanceMinor;
          return wallet;
        },
      ),
    },
    job: { findUnique: jest.fn(async () => options.job ?? null) },
    cancellationPolicy: { findMany: jest.fn(async () => []) },
    $executeRawUnsafe: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => []),
  };

  const prisma = {
    ...tx,
    // PrismaService.withLedgerWrite opens a transaction with the ledger-write GUC set;
    // the harness just hands the callback the same tx mock.
    withLedgerWrite: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  const commission = {
    resolve: jest.fn(async () => ({ percent: 10, fixedMinor: 0n, policyId: null })),
  } as unknown as CommissionService;
  const walletService = {
    getOrCreate: jest.fn(async (_ownerType: string, ownerId: string) =>
      wallets.get(ownerId === PARTNER_ID ? PARTNER_WALLET : PARTNER_WALLET),
    ),
  } as unknown as WalletService;
  const events = new EventEmitter2();
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;

  const service = new LedgerService(prisma, commission, walletService, events, logger);
  return { service, tx, prisma, accounts, wallets, entries, events };
}

const netFor = (entries: EntryRow[], accountId: string): bigint =>
  entries.reduce(
    (sum, e) =>
      e.accountId !== accountId
        ? sum
        : e.direction === LedgerEntryDirection.CREDIT
          ? sum + e.amountMinor
          : sum - e.amountMinor,
    0n,
  );

describe('LedgerService.post', () => {
  it('writes balanced entries with running balances and refreshes the wallet cache', async () => {
    const { service, tx, accounts, wallets, entries } = buildHarness();

    await service.post({
      type: LedgerTransactionType.BONUS,
      currency: 'ILS',
      entries: [
        {
          accountCode: 'PLATFORM_PAYABLES:ILS',
          direction: LedgerEntryDirection.DEBIT,
          amountMinor: 500n,
        },
        { walletId: PARTNER_WALLET, direction: LedgerEntryDirection.CREDIT, amountMinor: 500n },
      ],
      description: 'Loyalty bonus',
      idempotencyKey: 'bonus:1',
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL tamam.ledger_write = 'on'");
    expect(entries).toHaveLength(2);
    const walletAccount = accounts.get(`WALLET:${PARTNER_WALLET}`);
    expect(walletAccount).toBeDefined();
    expect(netFor(entries, walletAccount?.id ?? '')).toBe(500n);
    expect(entries.every((e) => e.transactionId === 'tx-1')).toBe(true);
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: PARTNER_WALLET },
      data: { balanceMinor: 500n },
    });
    expect(wallets.get(PARTNER_WALLET)?.balanceMinor).toBe(500n);
  });

  it('is idempotent: an existing idempotency key returns the stored transaction untouched', async () => {
    const { service, tx } = buildHarness({
      existingTransaction: { id: 'tx-existing', idempotencyKey: 'bonus:1', entries: [] },
    });

    const result = await service.post({
      type: LedgerTransactionType.BONUS,
      currency: 'ILS',
      entries: [
        {
          accountCode: 'PLATFORM_PAYABLES:ILS',
          direction: LedgerEntryDirection.DEBIT,
          amountMinor: 500n,
        },
        { walletId: PARTNER_WALLET, direction: LedgerEntryDirection.CREDIT, amountMinor: 500n },
      ],
      description: 'Loyalty bonus',
      idempotencyKey: 'bonus:1',
    });

    expect(result.id).toBe('tx-existing');
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('refuses an unbalanced transaction before touching the database', async () => {
    const { service, tx } = buildHarness();

    await expect(
      service.post({
        type: LedgerTransactionType.BONUS,
        currency: 'ILS',
        entries: [
          {
            accountCode: 'PLATFORM_PAYABLES:ILS',
            direction: LedgerEntryDirection.DEBIT,
            amountMinor: 500n,
          },
          { walletId: PARTNER_WALLET, direction: LedgerEntryDirection.CREDIT, amountMinor: 400n },
        ],
        description: 'Broken bonus',
        idempotencyKey: 'bonus:2',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown platform account code', async () => {
    const { service } = buildHarness();

    await expect(
      service.post({
        type: LedgerTransactionType.BONUS,
        currency: 'ILS',
        entries: [
          {
            accountCode: 'NOT_AN_ACCOUNT:ILS',
            direction: LedgerEntryDirection.DEBIT,
            amountMinor: 500n,
          },
          { walletId: PARTNER_WALLET, direction: LedgerEntryDirection.CREDIT, amountMinor: 500n },
        ],
        description: 'Broken bonus',
        idempotencyKey: 'bonus:3',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});

describe('LedgerService.settleJob', () => {
  const decimal = (value: number) => ({ toNumber: () => value }) as unknown as Prisma.Decimal;

  const cashJob = {
    id: JOB_ID,
    number: 'TM-2603-000123',
    type: 'RIDE',
    currency: 'ILS',
    paymentMethod: PaymentMethod.CASH,
    customerId: CUSTOMER_ID,
    partnerId: PARTNER_ID,
    categoryId: null,
    zoneId: '55555555-5555-4555-8555-555555555555',
    estimatedTotalMinor: 10_000n,
    finalTotalMinor: 10_000n,
    promoDiscountMinor: 0n,
    cancellationFeeMinor: 0n,
    completedAt: new Date('2026-03-15T10:00:00.000Z'),
    pricingSnapshot: { commissionPercent: decimal(15), commissionFixedMinor: 0n },
  };

  it('books a cash ride so the partner wallet nets minus the commission', async () => {
    const { service, tx, accounts, entries, events } = buildHarness({ job: cashJob });
    const settled = jest.fn();
    events.on('ledger.job_settled', settled);

    const result = await service.settleJob(JOB_ID);

    expect(result).not.toBeNull();
    const created = tx.ledgerTransaction.create.mock.calls[0]?.[0] as
      { data: { idempotencyKey: string; type: string; jobId: string } } | undefined;
    expect(created?.data.idempotencyKey).toBe(`settle:${JOB_ID}`);
    expect(created?.data.type).toBe(LedgerTransactionType.JOB_CHARGE);

    const walletAccount = accounts.get(`WALLET:${PARTNER_WALLET}`);
    const revenueAccount = accounts.get('PLATFORM_REVENUE:ILS');
    const cashAccount = accounts.get('PLATFORM_CASH_CLEARING:ILS');
    expect(netFor(entries, walletAccount?.id ?? '')).toBe(-1_500n);
    expect(netFor(entries, revenueAccount?.id ?? '')).toBe(1_500n);
    expect(netFor(entries, cashAccount?.id ?? '')).toBe(0n);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('returns the stored transaction instead of settling twice', async () => {
    const { service, tx } = buildHarness({
      job: cashJob,
      existingTransaction: { id: 'tx-settled', idempotencyKey: `settle:${JOB_ID}`, entries: [] },
    });

    const result = await service.settleJob(JOB_ID);

    expect(result?.id).toBe('tx-settled');
    expect(tx.ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('does nothing for a job with no money to move', async () => {
    const { service, tx } = buildHarness({
      job: {
        ...cashJob,
        finalTotalMinor: 0n,
        estimatedTotalMinor: 0n,
        promoDiscountMinor: 0n,
        cancellationFeeMinor: 0n,
      },
    });

    await expect(service.settleJob(JOB_ID)).resolves.toBeNull();
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('falls back to the commission policy when the job has no pricing snapshot', async () => {
    const { service, accounts, entries } = buildHarness({
      job: { ...cashJob, pricingSnapshot: null },
    });

    await service.settleJob(JOB_ID);

    // CommissionService stub resolves 10% → 1 000 of a 10 000 fare.
    const revenueAccount = accounts.get('PLATFORM_REVENUE:ILS');
    expect(netFor(entries, revenueAccount?.id ?? '')).toBe(1_000n);
  });

  it('refuses to settle a job that has no partner', async () => {
    const { service } = buildHarness({ job: { ...cashJob, partnerId: null } });

    await expect(service.settleJob(JOB_ID)).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });
});
