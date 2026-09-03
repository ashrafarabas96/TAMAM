import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ReferralProgram, ReferralReward } from '@prisma/client';
import {
  JobStatus,
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  type LocalizedText,
  type Money,
  type Page,
  WalletOwnerType,
} from '@tamam/shared-types';
import type { UpsertReferralProgramInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { formatMajor, toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { platformAccountCode } from '../ledger/domain/ledger.rules';
import { type LedgerPostEntry, LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';

export const ReferralRewardStatus = { PENDING: 'PENDING', GRANTED: 'GRANTED', BLOCKED: 'BLOCKED' } as const;
export type ReferralRewardStatus = (typeof ReferralRewardStatus)[keyof typeof ReferralRewardStatus];

/** Fraud signals checked before a referral pays out. A shared phone prefix is deliberately not one. */
export const ReferralFraudFlag = {
  SELF_REFERRAL: 'SELF_REFERRAL',
  SHARED_DEVICE: 'SHARED_DEVICE',
  MAX_REWARDS_EXCEEDED: 'MAX_REWARDS_EXCEEDED',
} as const;
export type ReferralFraudFlag = (typeof ReferralFraudFlag)[keyof typeof ReferralFraudFlag];

export interface ReferralProgramDto {
  id: string;
  inviterReward: Money;
  inviteeReward: Money;
  currency: string;
  rewardOn: string;
  minFirstJob: Money;
  maxRewardsPerInviter: number;
  codeExpiryDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRewardDto {
  id: string;
  programId: string;
  inviterId: string;
  inviteeId: string;
  triggerJobId: string | null;
  status: string;
  inviterReward: Money;
  inviteeReward: Money;
  currency: string;
  fraudFlags: string[];
  grantedAt: string | null;
  createdAt: string;
}

export interface MyReferralDto {
  code: string;
  shareUrl: string;
  shareText: LocalizedText;
  program: ReferralProgramDto | null;
  invitedCount: number;
  rewardedCount: number;
}

export interface ReferralRewardFilter {
  status?: string;
  inviterId?: string;
  cursor?: string;
  limit: number;
}

interface JobCompletedEventLike {
  jobId: string;
  customerId?: string;
}

/**
 * Referral programme (spec §61). One reward per invitee, granted on their first completed job,
 * paid from `PLATFORM_PROMO_EXPENSE` into both wallets, and blocked (never silently dropped)
 * when a fraud signal fires so support can review it.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly logger: PinoLogger,
  ) {}

  /* ------------------------------------------------------------------ self */

  async getMyCode(userId: string): Promise<MyReferralDto> {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId }, select: { referralCode: true } });
    if (!customer) throw AppException.notFound('Customer profile', userId);
    const program = await this.activeProgram();
    const [invitedCount, rewardedCount] = await Promise.all([
      this.prisma.customerProfile.count({ where: { referredById: userId } }),
      this.prisma.referralReward.count({ where: { inviterId: userId, status: ReferralRewardStatus.GRANTED } }),
    ]);
    const shareUrl = `${this.appConfig.env.DEEP_LINK_SCHEME}://invite/${customer.referralCode}`;
    const reward = program ? formatMajor(program.inviteeRewardMinor, program.currency) : '';
    return {
      code: customer.referralCode,
      shareUrl,
      shareText: {
        ar: `انضم إلى تمام باستخدام رمز الدعوة ${customer.referralCode}${reward ? ` واحصل على ${reward}` : ''}: ${shareUrl}`,
        en: `Join TAMAM with my invite code ${customer.referralCode}${reward ? ` and get ${reward}` : ''}: ${shareUrl}`,
      },
      program: program ? this.toProgramDto(program) : null,
      invitedCount,
      rewardedCount,
    };
  }

  /* ------------------------------------------------------------ granting */

  @OnEvent('job.completed')
  async handleJobCompleted(event: JobCompletedEventLike): Promise<void> {
    try {
      const customerId = event.customerId ?? (await this.prisma.job.findUnique({ where: { id: event.jobId }, select: { customerId: true } }))?.customerId;
      if (!customerId) return;
      await this.onCustomerFirstJobCompleted(customerId, event.jobId);
    } catch (err) {
      // An event listener must never break the job pipeline; the reward stays ungranted and visible in logs.
      this.logger.error({ err, jobId: event.jobId }, 'referral reward evaluation failed');
    }
  }

  /**
   * Grants the referral reward once the invitee's first job completes. Idempotent: the unique
   * `invitee_id` on `referral_rewards` means a second call can never pay twice.
   */
  async onCustomerFirstJobCompleted(customerId: string, jobId: string): Promise<ReferralRewardDto | null> {
    const program = await this.activeProgram();
    if (!program || program.rewardOn !== 'FIRST_COMPLETED_JOB') return null;

    const invitee = await this.prisma.customerProfile.findUnique({ where: { userId: customerId }, select: { userId: true, referredById: true } });
    if (!invitee?.referredById) return null;

    const existing = await this.prisma.referralReward.findUnique({ where: { inviteeId: customerId } });
    if (existing) return this.toRewardDto(existing);

    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { customerId: true, status: true, finalTotalMinor: true, currency: true } });
    if (!job || job.customerId !== customerId || job.status !== JobStatus.COMPLETED) return null;
    if ((job.finalTotalMinor ?? 0n) < program.minFirstJobMinor) return null;

    const completedJobs = await this.prisma.job.count({ where: { customerId, status: JobStatus.COMPLETED } });
    if (completedJobs > 1) return null; // rewards are only for the *first* completed job

    const inviterId = invitee.referredById;
    const fraudFlags = await this.fraudFlags(inviterId, customerId, program);

    if (fraudFlags.length) {
      const blocked = await this.prisma.referralReward.create({
        data: {
          programId: program.id,
          inviterId,
          inviteeId: customerId,
          triggerJobId: jobId,
          status: ReferralRewardStatus.BLOCKED,
          inviterRewardMinor: program.inviterRewardMinor,
          inviteeRewardMinor: program.inviteeRewardMinor,
          currency: program.currency,
          fraudFlags,
        },
      });
      this.logger.warn({ inviterId, inviteeId: customerId, fraudFlags }, 'referral reward blocked');
      return this.toRewardDto(blocked);
    }

    const reward = await this.prisma.withLedgerWrite(async (tx) => {
      const created = await tx.referralReward.create({
        data: {
          programId: program.id,
          inviterId,
          inviteeId: customerId,
          triggerJobId: jobId,
          status: ReferralRewardStatus.GRANTED,
          inviterRewardMinor: program.inviterRewardMinor,
          inviteeRewardMinor: program.inviteeRewardMinor,
          currency: program.currency,
          fraudFlags: [],
          grantedAt: new Date(),
        },
      });
      await this.postReward(created, program, tx);
      return created;
    });

    this.logger.info({ rewardId: reward.id, inviterId, inviteeId: customerId }, 'referral reward granted');
    return this.toRewardDto(reward);
  }

  private async postReward(reward: ReferralReward, program: ReferralProgram, tx: Tx): Promise<void> {
    const total = program.inviterRewardMinor + program.inviteeRewardMinor;
    if (total <= 0n) return;
    const entries: LedgerPostEntry[] = [
      {
        accountCode: platformAccountCode(LedgerAccountType.PLATFORM_PROMO_EXPENSE, program.currency),
        direction: LedgerEntryDirection.DEBIT,
        amountMinor: total,
      },
    ];
    if (program.inviterRewardMinor > 0n) {
      const wallet = await this.wallets.getOrCreate(WalletOwnerType.CUSTOMER, reward.inviterId, program.currency, tx);
      entries.push({ walletId: wallet.id, direction: LedgerEntryDirection.CREDIT, amountMinor: program.inviterRewardMinor });
    }
    if (program.inviteeRewardMinor > 0n) {
      const wallet = await this.wallets.getOrCreate(WalletOwnerType.CUSTOMER, reward.inviteeId, program.currency, tx);
      entries.push({ walletId: wallet.id, direction: LedgerEntryDirection.CREDIT, amountMinor: program.inviteeRewardMinor });
    }
    await this.ledger.post(
      {
        type: LedgerTransactionType.REFERRAL_REWARD,
        currency: program.currency,
        entries,
        reference: reward.id,
        description: `Referral reward for invitee ${reward.inviteeId}`,
        idempotencyKey: `referral:${reward.id}`,
      },
      tx,
    );
  }

  /**
   * Fraud signals (spec §61): the same physical device on both sides, an inviter past their cap,
   * or a self-referral. Phone-number similarity is explicitly *not* a signal — families share
   * prefixes in Palestine and would be punished for it.
   */
  private async fraudFlags(inviterId: string, inviteeId: string, program: ReferralProgram): Promise<ReferralFraudFlag[]> {
    const flags: ReferralFraudFlag[] = [];
    if (inviterId === inviteeId) flags.push(ReferralFraudFlag.SELF_REFERRAL);

    const [inviterDevices, inviteeDevices] = await Promise.all([
      this.prisma.userSession.findMany({ where: { userId: inviterId }, select: { deviceId: true }, distinct: ['deviceId'] }),
      this.prisma.userSession.findMany({ where: { userId: inviteeId }, select: { deviceId: true }, distinct: ['deviceId'] }),
    ]);
    const inviterSet = new Set(inviterDevices.map((d) => d.deviceId));
    if (inviteeDevices.some((d) => inviterSet.has(d.deviceId))) flags.push(ReferralFraudFlag.SHARED_DEVICE);

    const granted = await this.prisma.referralReward.count({ where: { inviterId, status: ReferralRewardStatus.GRANTED } });
    if (granted >= program.maxRewardsPerInviter) flags.push(ReferralFraudFlag.MAX_REWARDS_EXCEEDED);

    return flags;
  }

  /* ----------------------------------------------------------------- admin */

  async getProgram(): Promise<ReferralProgramDto | null> {
    const program = await this.activeProgram();
    return program ? this.toProgramDto(program) : null;
  }

  async upsertProgram(input: UpsertReferralProgramInput, actor: RequestUser, requestId: string | null): Promise<ReferralProgramDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.referralProgram.findFirst({ orderBy: { createdAt: 'desc' } });
      const data = {
        inviterRewardMinor: BigInt(input.inviterRewardMinor),
        inviteeRewardMinor: BigInt(input.inviteeRewardMinor),
        currency: input.currency,
        rewardOn: input.rewardOn,
        minFirstJobMinor: BigInt(input.minFirstJobMinor),
        maxRewardsPerInviter: input.maxRewardsPerInviter,
        codeExpiryDays: input.codeExpiryDays,
        isActive: input.isActive,
      };
      const program = before ? await tx.referralProgram.update({ where: { id: before.id }, data }) : await tx.referralProgram.create({ data });
      await this.audit.record(
        {
          actorId: actor.id,
          action: before ? 'referral_program.update' : 'referral_program.create',
          entity: 'referral_program',
          entityId: program.id,
          oldValue: before ? { inviterRewardMinor: before.inviterRewardMinor.toString(), inviteeRewardMinor: before.inviteeRewardMinor.toString(), isActive: before.isActive } : null,
          newValue: { inviterRewardMinor: input.inviterRewardMinor, inviteeRewardMinor: input.inviteeRewardMinor, isActive: input.isActive },
          requestId,
        },
        tx,
      );
      return program;
    });
    return this.toProgramDto(row);
  }

  async listRewards(filter: ReferralRewardFilter): Promise<Page<ReferralRewardDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.referralReward.findMany({
      where: { ...cursorWhere(cursor), status: filter.status, inviterId: filter.inviterId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (r) => this.toRewardDto(r));
  }

  /* --------------------------------------------------------------- helpers */

  private async activeProgram(): Promise<ReferralProgram | null> {
    const active = await this.prisma.referralProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    return active ?? this.prisma.referralProgram.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  private toProgramDto(program: ReferralProgram): ReferralProgramDto {
    return {
      id: program.id,
      inviterReward: toMoney(program.inviterRewardMinor, program.currency),
      inviteeReward: toMoney(program.inviteeRewardMinor, program.currency),
      currency: program.currency,
      rewardOn: program.rewardOn,
      minFirstJob: toMoney(program.minFirstJobMinor, program.currency),
      maxRewardsPerInviter: program.maxRewardsPerInviter,
      codeExpiryDays: program.codeExpiryDays,
      isActive: program.isActive,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
    };
  }

  private toRewardDto(reward: ReferralReward): ReferralRewardDto {
    return {
      id: reward.id,
      programId: reward.programId,
      inviterId: reward.inviterId,
      inviteeId: reward.inviteeId,
      triggerJobId: reward.triggerJobId,
      status: reward.status,
      inviterReward: toMoney(reward.inviterRewardMinor, reward.currency),
      inviteeReward: toMoney(reward.inviteeRewardMinor, reward.currency),
      currency: reward.currency,
      fraudFlags: reward.fraudFlags,
      grantedAt: reward.grantedAt ? reward.grantedAt.toISOString() : null,
      createdAt: reward.createdAt.toISOString(),
    };
  }
}
