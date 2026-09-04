import {
  AccountStatus,
  DisputeStatus,
  ErrorCode,
  JobActorType,
  JobStatus,
  LedgerEntryDirection,
  LedgerTransactionType,
  Permission,
  PaymentStatus,
  UserRole,
} from '@tamam/shared-types';
import type { PinoLogger } from 'nestjs-pino';

import type { RequestUser } from '../../common/types/request-user';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { JobsService } from '../jobs/jobs.service';
import type { LedgerService } from '../ledger/ledger.service';
import type { MediaUrlService } from '../media/media-url.service';
import type { MediaService } from '../media/media.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PaymentsService } from '../payments/payments.service';
import type { WalletService } from '../wallet/wallet.service';

import { DisputesService } from './disputes.service';
import {
  assertJobDisputable,
  disputeNumber,
  partnerAdjustmentEntries,
} from './domain/dispute-decision';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const DISPUTE_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const PARTNER_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_ID = '55555555-5555-4555-8555-555555555555';
const ZONE_ID = '66666666-6666-4666-8666-666666666666';
const PAYMENT_ID = '77777777-7777-4777-8777-777777777777';
const WALLET_ID = '88888888-8888-4888-8888-888888888888';

interface DisputeState {
  id: string;
  number: string;
  jobId: string;
  customerId: string;
  partnerId: string;
  openedByRole: string;
  status: DisputeStatus;
  reason: string;
  description: string;
  requestedRefundMinor: bigint | null;
  refundMinor: bigint;
  partnerAdjustmentMinor: bigint;
  currency: string;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  evidence: Array<{
    media: {
      bucket: string;
      objectKey: string;
      isPublic: boolean;
      mediumKey: string | null;
      thumbnailKey: string | null;
    };
  }>;
  messages: Array<{
    id: string;
    disputeId: string;
    authorId: string;
    text: string;
    isInternal: boolean;
    createdAt: Date;
    author: { fullName: string | null };
  }>;
}

function disputeState(overrides: Partial<DisputeState> = {}): DisputeState {
  return {
    id: DISPUTE_ID,
    number: 'DP-2604-000001',
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    partnerId: PARTNER_ID,
    openedByRole: UserRole.CUSTOMER,
    status: DisputeStatus.UNDER_REVIEW,
    reason: 'POOR_QUALITY',
    description: 'The tap still leaks after the visit.',
    requestedRefundMinor: 5_000n,
    refundMinor: 0n,
    partnerAdjustmentMinor: 0n,
    currency: 'ILS',
    decidedById: null,
    decidedAt: null,
    decisionReason: null,
    createdAt: new Date('2026-04-01T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:00:00.000Z'),
    evidence: [],
    messages: [],
    ...overrides,
  };
}

function principal(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: CUSTOMER_ID,
    phone: '+970599000001',
    roles: [UserRole.CUSTOMER],
    permissions: [],
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    language: 'ar',
    customerId: CUSTOMER_ID,
    isSuperAdmin: false,
    ...overrides,
  };
}

const admin = (): RequestUser =>
  principal({
    id: ADMIN_ID,
    customerId: undefined,
    roles: [UserRole.ADMIN],
    permissions: [Permission.DISPUTES_READ, Permission.DISPUTES_DECIDE],
  });

function buildHarness(
  options: {
    dispute?: DisputeState;
    jobStatus?: JobStatus;
    live?: DisputeState | null;
    hasPayment?: boolean;
  } = {},
) {
  const dispute = options.dispute ?? disputeState();
  const job = {
    id: JOB_ID,
    customerId: CUSTOMER_ID,
    partnerId: PARTNER_ID,
    status: options.jobStatus ?? JobStatus.DISPUTED,
    zoneId: ZONE_ID,
    currency: 'ILS',
  };
  const createdDisputes: Array<Record<string, unknown>> = [];

  const disputeUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(dispute, data);
    return dispute;
  });

  const prisma = {
    job: { findUnique: jest.fn(async () => job) },
    dispute: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        createdDisputes.push(data);
        Object.assign(dispute, {
          number: String(data.number),
          openedByRole: String(data.openedByRole),
          status: DisputeStatus.OPEN,
        });
        return { id: dispute.id };
      }),
      update: disputeUpdate,
      // A snapshot, like a real read: the service must not see its own later write through it.
      findUnique: jest.fn(async () => ({ ...dispute })),
      findUniqueOrThrow: jest.fn(async () => dispute),
      findFirst: jest.fn(async () => options.live ?? null),
      findMany: jest.fn(async () => [dispute]),
      count: jest.fn(async () => 2),
    },
    disputeMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `dm-${dispute.messages.length + 1}`,
          disputeId: String(data.disputeId),
          authorId: String(data.authorId),
          text: String(data.text),
          isInternal: Boolean(data.isInternal),
          createdAt: new Date('2026-04-01T09:00:00.000Z'),
          author: { fullName: 'Layla Nasser' },
        };
        dispute.messages.push(row);
        return { id: row.id };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) =>
        dispute.messages.find((m) => m.id === where.id),
      ),
    },
    disputeEvidence: {
      createMany: jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
    payment: {
      findFirst: jest.fn(async () =>
        options.hasPayment === false ? null : { id: PAYMENT_ID, status: PaymentStatus.CAPTURED },
      ),
    },
    user: {
      findUnique: jest.fn(async () => ({ fullName: 'Layla Nasser', phone: '+970599000001' })),
    },
    nextCounter: jest.fn(async () => 1n),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const assertOwnedReady = jest.fn(async () => undefined);
  const media = { assertOwnedReady } as unknown as MediaService;
  const mediaUrls = {
    urlFor: jest.fn(() => '/api/v1/media/key/view'),
  } as unknown as MediaUrlService;
  const notify = jest.fn(async () => undefined);
  const notifications = { notify } as unknown as NotificationsService;
  const refund = jest.fn(async () => ({ id: 'refund-1' }));
  const payments = { refund } as unknown as PaymentsService;
  const post = jest.fn(async () => ({ id: 'ltx-1' }));
  const ledger = { post } as unknown as LedgerService;
  const getOrCreate = jest.fn(async () => ({ id: WALLET_ID, currency: 'ILS' }));
  const wallets = { getOrCreate } as unknown as WalletService;
  const record = jest.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
  const transition = jest.fn(async () => ({ id: JOB_ID }));
  const jobs = { transition } as unknown as JobsService;

  const service = new DisputesService(
    prisma,
    media,
    mediaUrls,
    notifications,
    payments,
    ledger,
    wallets,
    audit,
    logger,
    jobs,
  );
  return {
    service,
    dispute,
    createdDisputes,
    mocks: {
      refund,
      post,
      getOrCreate,
      record,
      notify,
      transition,
      disputeUpdate,
      assertOwnedReady,
    },
  };
}

describe('dispute domain rules', () => {
  it('formats dispute numbers as DP-YYMM-NNNNNN', () => {
    expect(disputeNumber(7n, new Date('2026-04-15T00:00:00.000Z'))).toBe('DP-2604-000007');
  });

  it('lets a customer dispute finished work but a partner only a closed job', () => {
    expect(() => assertJobDisputable(JobStatus.WORK_COMPLETED, true)).not.toThrow();
    expect(() => assertJobDisputable(JobStatus.COMPLETED, true)).not.toThrow();
    expect(() => assertJobDisputable(JobStatus.WORK_COMPLETED, false)).toThrow();
    expect(() => assertJobDisputable(JobStatus.IN_PROGRESS, true)).toThrow();
  });

  it('debits the partner wallet for a negative adjustment and credits it for a positive one', () => {
    const negative = partnerAdjustmentEntries({
      adjustmentMinor: -2_500n,
      currency: 'ILS',
      partnerWalletId: WALLET_ID,
    });
    expect(negative).toEqual([
      { walletId: WALLET_ID, direction: LedgerEntryDirection.DEBIT, amountMinor: 2_500n },
      {
        accountCode: 'PLATFORM_REFUND_EXPENSE:ILS',
        direction: LedgerEntryDirection.CREDIT,
        amountMinor: 2_500n,
      },
    ]);

    const positive = partnerAdjustmentEntries({
      adjustmentMinor: 2_500n,
      currency: 'ILS',
      partnerWalletId: WALLET_ID,
    });
    expect(positive).toEqual([
      { walletId: WALLET_ID, direction: LedgerEntryDirection.CREDIT, amountMinor: 2_500n },
      {
        accountCode: 'PLATFORM_REFUND_EXPENSE:ILS',
        direction: LedgerEntryDirection.DEBIT,
        amountMinor: 2_500n,
      },
    ]);

    expect(
      partnerAdjustmentEntries({
        adjustmentMinor: 0n,
        currency: 'ILS',
        partnerWalletId: WALLET_ID,
      }),
    ).toEqual([]);
  });

  it('keeps every adjustment balanced', () => {
    for (const amount of [-10_000n, -1n, 1n, 10_000n]) {
      const entries = partnerAdjustmentEntries({
        adjustmentMinor: amount,
        currency: 'ILS',
        partnerWalletId: WALLET_ID,
      });
      const debits = entries
        .filter((e) => e.direction === LedgerEntryDirection.DEBIT)
        .reduce((sum, e) => sum + e.amountMinor, 0n);
      const credits = entries
        .filter((e) => e.direction === LedgerEntryDirection.CREDIT)
        .reduce((sum, e) => sum + e.amountMinor, 0n);
      expect(debits).toBe(credits);
    }
  });
});

describe('DisputesService.open', () => {
  it('numbers the dispute, stores the evidence and moves a completed job to DISPUTED', async () => {
    const { service, createdDisputes, mocks } = buildHarness({ jobStatus: JobStatus.COMPLETED });
    const mediaId = '99999999-9999-4999-8999-999999999999';

    const dto = await service.open(principal(), {
      jobId: JOB_ID,
      reason: 'POOR_QUALITY',
      description: 'The tap still leaks after the visit.',
      requestedRefundMinor: 5_000,
      evidenceMediaIds: [mediaId],
    });

    expect(dto.number).toMatch(/^DP-\d{4}-000001$/);
    expect(createdDisputes[0]).toMatchObject({ openedByRole: UserRole.CUSTOMER, currency: 'ILS' });
    expect(mocks.assertOwnedReady).toHaveBeenCalledWith(
      CUSTOMER_ID,
      [mediaId],
      ['DISPUTE_EVIDENCE'],
    );
    expect(mocks.transition).toHaveBeenCalledWith(
      JOB_ID,
      JobStatus.DISPUTED,
      { type: JobActorType.CUSTOMER, id: CUSTOMER_ID },
      expect.any(Object),
    );
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: PARTNER_ID }));
  });

  it('does not transition a job that is only WORK_COMPLETED', async () => {
    const { service, mocks } = buildHarness({ jobStatus: JobStatus.WORK_COMPLETED });

    await service.open(principal(), {
      jobId: JOB_ID,
      reason: 'NOT_COMPLETED',
      description: 'Work was never finished.',
      evidenceMediaIds: [],
    });

    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it('refuses a second live dispute on the same job', async () => {
    const { service } = buildHarness({
      jobStatus: JobStatus.COMPLETED,
      live: disputeState({ status: DisputeStatus.OPEN }),
    });

    await expect(
      service.open(principal(), {
        jobId: JOB_ID,
        reason: 'OVERCHARGED',
        description: 'Charged more than quoted.',
        evidenceMediaIds: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('refuses somebody who is not a party of the job', async () => {
    const { service } = buildHarness({ jobStatus: JobStatus.COMPLETED });
    const outsider = principal({ id: ADMIN_ID, customerId: ADMIN_ID });

    await expect(
      service.open(outsider, {
        jobId: JOB_ID,
        reason: 'DAMAGE',
        description: 'Something went wrong here.',
        evidenceMediaIds: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('refuses a partner disputing a job that is not yet COMPLETED', async () => {
    const { service } = buildHarness({ jobStatus: JobStatus.WORK_COMPLETED });
    const partner = principal({
      id: PARTNER_ID,
      customerId: undefined,
      partnerId: PARTNER_ID,
      roles: [UserRole.PARTNER],
    });

    await expect(
      service.open(partner, {
        jobId: JOB_ID,
        reason: 'CUSTOMER_MISCONDUCT',
        description: 'The customer refused entry.',
        evidenceMediaIds: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_STATE_TRANSITION });
  });
});

describe('DisputesService.decide', () => {
  it('refunds the customer, books the partner adjustment and returns the job to COMPLETED', async () => {
    const { service, dispute, mocks } = buildHarness();

    const dto = await service.decide(
      DISPUTE_ID,
      {
        decision: DisputeStatus.RESOLVED_CUSTOMER,
        refundMinor: 5_000,
        partnerAdjustmentMinor: -5_000,
        reason: 'Work was not delivered as quoted.',
      },
      admin(),
      'req-1',
    );

    expect(mocks.refund).toHaveBeenCalledWith(
      {
        paymentId: PAYMENT_ID,
        amountMinor: 5_000,
        reason: 'Work was not delivered as quoted.',
        disputeId: DISPUTE_ID,
      },
      expect.objectContaining({ id: ADMIN_ID }),
      'req-1',
    );
    expect(mocks.getOrCreate).toHaveBeenCalledWith('PARTNER', PARTNER_ID, 'ILS');
    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LedgerTransactionType.DISPUTE_SETTLEMENT,
        currency: 'ILS',
        idempotencyKey: `dispute:${DISPUTE_ID}:partner-adjustment`,
        entries: [
          { walletId: WALLET_ID, direction: LedgerEntryDirection.DEBIT, amountMinor: 5_000n },
          {
            accountCode: 'PLATFORM_REFUND_EXPENSE:ILS',
            direction: LedgerEntryDirection.CREDIT,
            amountMinor: 5_000n,
          },
        ],
      }),
    );
    expect(mocks.transition).toHaveBeenCalledWith(
      JOB_ID,
      JobStatus.COMPLETED,
      { type: JobActorType.ADMIN, id: ADMIN_ID },
      expect.any(Object),
    );
    expect(dispute.status).toBe(DisputeStatus.RESOLVED_CUSTOMER);
    expect(dispute.refundMinor).toBe(5_000n);
    expect(dispute.partnerAdjustmentMinor).toBe(-5_000n);
    expect(dto.refund).toEqual({ amount: 5_000, currency: 'ILS' });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });

  it('skips the refund and the ledger when the decision costs nothing', async () => {
    const { service, mocks } = buildHarness();

    await service.decide(
      DISPUTE_ID,
      {
        decision: DisputeStatus.REJECTED,
        refundMinor: 0,
        partnerAdjustmentMinor: 0,
        reason: 'Evidence did not support the claim.',
      },
      admin(),
      'req-2',
    );

    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.transition).toHaveBeenCalledTimes(1);
  });

  it('credits the partner when the adjustment is positive', async () => {
    const { service, mocks } = buildHarness();

    await service.decide(
      DISPUTE_ID,
      {
        decision: DisputeStatus.RESOLVED_PARTNER,
        refundMinor: 0,
        partnerAdjustmentMinor: 3_000,
        reason: 'The partner absorbed an unfair cancellation.',
      },
      admin(),
      'req-3',
    );

    expect(mocks.post).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          { walletId: WALLET_ID, direction: LedgerEntryDirection.CREDIT, amountMinor: 3_000n },
          {
            accountCode: 'PLATFORM_REFUND_EXPENSE:ILS',
            direction: LedgerEntryDirection.DEBIT,
            amountMinor: 3_000n,
          },
        ],
      }),
    );
  });

  it('writes a sensitive audit entry with the old and new money', async () => {
    const { service, mocks } = buildHarness();

    await service.decide(
      DISPUTE_ID,
      {
        decision: DisputeStatus.RESOLVED_SPLIT,
        refundMinor: 2_000,
        partnerAdjustmentMinor: -1_000,
        reason: 'Both sides carry part of the loss.',
      },
      admin(),
      'req-4',
    );

    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dispute.decide',
        entity: 'dispute',
        entityId: DISPUTE_ID,
        oldValue: expect.objectContaining({ refundMinor: '0', partnerAdjustmentMinor: '0' }),
        newValue: expect.objectContaining({ refundMinor: '2000', partnerAdjustmentMinor: '-1000' }),
        reason: 'Both sides carry part of the loss.',
      }),
      expect.anything(),
    );
  });

  it('refuses to decide a dispute twice', async () => {
    const { service } = buildHarness({
      dispute: disputeState({ status: DisputeStatus.RESOLVED_CUSTOMER, refundMinor: 5_000n }),
    });

    await expect(
      service.decide(
        DISPUTE_ID,
        {
          decision: DisputeStatus.REJECTED,
          refundMinor: 0,
          partnerAdjustmentMinor: 0,
          reason: 'Changed my mind about it.',
        },
        admin(),
        'req-5',
      ),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('refuses a refund when the job has no captured payment', async () => {
    const { service, mocks } = buildHarness({ hasPayment: false });

    await expect(
      service.decide(
        DISPUTE_ID,
        {
          decision: DisputeStatus.RESOLVED_CUSTOMER,
          refundMinor: 1_000,
          partnerAdjustmentMinor: 0,
          reason: 'Refund the customer please.',
        },
        admin(),
        'req-6',
      ),
    ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_FAILED });
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe('DisputesService.addMessage', () => {
  it('ignores the internal flag for a party and notifies the other side', async () => {
    const { service, mocks } = buildHarness();

    const message = await service.addMessage(principal(), DISPUTE_ID, {
      text: 'Any update?',
      evidenceMediaIds: [],
      internal: true,
    });

    expect(message.internal).toBe(false);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: PARTNER_ID }));
  });

  it('keeps a staff internal note out of the notification path', async () => {
    const { service, mocks } = buildHarness();

    const message = await service.addMessage(admin(), DISPUTE_ID, {
      text: 'Finance approved 50 ILS.',
      evidenceMediaIds: [],
      internal: true,
    });

    expect(message.internal).toBe(true);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('hides a dispute the caller is not a party to', async () => {
    const { service } = buildHarness();
    const stranger = principal({
      id: '00000000-0000-4000-8000-000000000000',
      customerId: '00000000-0000-4000-8000-000000000000',
    });

    await expect(
      service.addMessage(stranger, DISPUTE_ID, {
        text: 'Hello',
        evidenceMediaIds: [],
        internal: false,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});

describe('DisputesService.openCount', () => {
  it('counts live disputes only', async () => {
    const { service } = buildHarness();
    await expect(service.openCount()).resolves.toBe(2);
  });
});
