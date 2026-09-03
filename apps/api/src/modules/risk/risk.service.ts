import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, type RestrictionKind } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, type Page, RestrictionTargetType, RiskSignal } from '@tamam/shared-types';
import type { UpsertRestrictionInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';

import { type RiskCounters, type RiskFinding, type RiskThresholds, emptyCounters, evaluateRiskRules } from './domain/risk.rules';

/* ------------------------------------------------------------- contracts */

export interface RiskSignalDto {
  id: string;
  userId: string;
  signal: RiskSignal;
  score: number;
  details: Record<string, unknown> | null;
  jobId: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
}

export interface RestrictionDto {
  id: string;
  targetType: RestrictionTargetType;
  targetId: string;
  kind: RestrictionKind;
  reason: string;
  createdById: string;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedById: string | null;
  liftReason: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RiskSignalListFilter {
  userId?: string;
  signal?: RiskSignal;
  unreviewed?: boolean;
  cursor?: string;
  limit: number;
}

export interface RestrictionListFilter {
  targetType?: RestrictionTargetType;
  targetId?: string;
  kind?: RestrictionKind;
  activeOnly?: boolean;
  cursor?: string;
  limit: number;
}

/* ---------------------------------------------------------------- events */

interface JobCancelledEventLike {
  jobId: string;
  customerId?: string;
  partnerId?: string | null;
  actorType?: string;
  actorId?: string | null;
}
interface PaymentFailedEventLike {
  jobId: string;
  paymentId?: string;
  customerId?: string;
}
interface PromoRedeemedEventLike {
  customerId?: string;
  userId?: string;
  jobId?: string;
  promoCodeId?: string;
}
interface ImpossibleMovementEventLike {
  userId?: string;
  partnerId?: string;
  jobId?: string;
  speedKmh: number;
}

const RESTRICTION_CACHE_S = 60;
const restrictionKey = (targetType: RestrictionTargetType, targetId: string): string => `risk:restr:${targetType}:${targetId}`;

interface CountRow {
  count: number;
}

/**
 * Fraud & abuse detection and the restriction system (spec §86–§87).
 *
 * Signals are advisory records for the risk queue — they never block a user by themselves.
 * Blocking is always an explicit `Restriction` row created by an operator, which the
 * `assertCanX` guards read (cached for 60 s per target).
 */
@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly systemConfig: SystemConfigService,
    private readonly logger: PinoLogger,
  ) {}

  /* -------------------------------------------------------------- signals */

  /**
   * Records one risk signal. Idempotent per (user, signal, UTC day): a user who cancels ten jobs
   * produces one signal to review, not ten.
   */
  async recordSignal(userId: string, signal: RiskSignal, score: number, details?: Record<string, unknown> | null, jobId?: string | null): Promise<RiskSignalDto> {
    const dayStart = utcDayStart(new Date());
    const existing = await this.prisma.riskSignalEvent.findFirst({
      where: { userId, signal, createdAt: { gte: dayStart } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      // Keep the highest score seen today so the queue is ordered by the worst observation.
      if (score > existing.score) {
        const bumped = await this.prisma.riskSignalEvent.update({
          where: { id: existing.id },
          data: { score, details: (details ?? Prisma.JsonNull) as Prisma.InputJsonValue },
        });
        return toSignalDto(bumped);
      }
      return toSignalDto(existing);
    }

    const created = await this.prisma.riskSignalEvent.create({
      data: {
        userId,
        signal,
        score: Math.min(100, Math.max(0, Math.round(score))),
        details: (details ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        jobId: jobId ?? null,
      },
    });
    this.logger.warn({ userId, signal, score, jobId: jobId ?? null }, 'risk signal recorded');
    return toSignalDto(created);
  }

  /**
   * Measures the counters for a user and records every rule that fired.
   *
   * `maxObservedSpeedKmh` is not measured here: impossible-movement is detected by the tracking
   * module while comparing consecutive samples, and arrives through `tracking.impossible_movement`.
   */
  async evaluateUser(userId: string): Promise<RiskFinding[]> {
    const [thresholds, counters] = await Promise.all([this.thresholds(), this.countersFor(userId)]);
    const findings = evaluateRiskRules(counters, thresholds);
    for (const finding of findings) {
      await this.recordSignal(userId, finding.signal, finding.score, finding.details);
    }
    return findings;
  }

  async listSignals(filter: RiskSignalListFilter): Promise<Page<RiskSignalDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.riskSignalEvent.findMany({
      where: {
        ...cursorWhere(cursor),
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.signal ? { signal: filter.signal } : {}),
        ...(filter.unreviewed ? { reviewedAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, toSignalDto);
  }

  async reviewSignal(id: string, actor: RequestUser): Promise<RiskSignalDto> {
    const existing = await this.prisma.riskSignalEvent.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('Risk signal', id);
    if (existing.reviewedAt) return toSignalDto(existing);
    const updated = await this.prisma.riskSignalEvent.update({ where: { id }, data: { reviewedAt: new Date(), reviewedById: actor.id } });
    return toSignalDto(updated);
  }

  /* --------------------------------------------------------- restrictions */

  async list(filter: RestrictionListFilter): Promise<Page<RestrictionDto>> {
    const cursor = decodeCursor(filter.cursor);
    const now = new Date();
    // The keyset cursor and the "active only" filter both need an OR clause, so they are ANDed
    // together instead of spread into the same object (where the second OR would win).
    const and: Prisma.RestrictionWhereInput[] = [cursorWhere(cursor) as Prisma.RestrictionWhereInput];
    if (filter.activeOnly) and.push({ liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

    const rows = await this.prisma.restriction.findMany({
      where: {
        AND: and,
        ...(filter.targetType ? { targetType: filter.targetType } : {}),
        ...(filter.targetId ? { targetId: filter.targetId } : {}),
        ...(filter.kind ? { kind: filter.kind } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (r) => toRestrictionDto(r, now));
  }

  async create(input: UpsertRestrictionInput, actor: RequestUser, requestId: string | null): Promise<RestrictionDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.restriction.create({
        data: {
          targetType: input.targetType,
          targetId: input.targetId,
          kind: input.kind,
          reason: input.reason,
          createdById: actor.id,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'risk.restriction.create',
          entity: 'restriction',
          entityId: created.id,
          newValue: { targetType: input.targetType, targetId: input.targetId, kind: input.kind, expiresAt: input.expiresAt ?? null },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return created;
    });

    await this.invalidate(row.targetType, row.targetId);
    return toRestrictionDto(row, new Date());
  }

  async lift(id: string, reason: string, actor: RequestUser, requestId: string | null): Promise<RestrictionDto> {
    const existing = await this.prisma.restriction.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('Restriction', id);
    if (existing.liftedAt) throw AppException.conflict('This restriction has already been lifted');

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.restriction.update({ where: { id }, data: { liftedAt: new Date(), liftedById: actor.id, liftReason: reason } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'risk.restriction.lift',
          entity: 'restriction',
          entityId: id,
          oldValue: { kind: existing.kind, targetType: existing.targetType, targetId: existing.targetId },
          newValue: { liftedAt: updated.liftedAt?.toISOString() ?? null },
          reason,
          requestId,
        },
        tx,
      );
      return updated;
    });

    await this.invalidate(row.targetType, row.targetId);
    return toRestrictionDto(row, new Date());
  }

  /* ------------------------------------------------------------- guards */

  async assertCanCreateJob(userId: string, deviceId?: string | null): Promise<void> {
    await this.assertNotRestricted('BLOCK_JOBS', userId, deviceId, 'Your account is restricted from booking new jobs. Contact support.');
  }

  async assertCanUsePromo(userId: string, deviceId?: string | null): Promise<void> {
    await this.assertNotRestricted('BLOCK_PROMOS', userId, deviceId, 'Your account is restricted from using promo codes. Contact support.');
  }

  async assertCanUseWallet(userId: string, deviceId?: string | null): Promise<void> {
    await this.assertNotRestricted('BLOCK_WALLET', userId, deviceId, 'Your wallet is restricted. Contact support.');
  }

  async assertCanLogin(userId: string, deviceId?: string | null): Promise<void> {
    await this.assertNotRestricted('BLOCK_LOGIN', userId, deviceId, 'Sign-in is blocked for this account. Contact support.');
  }

  /** True when an active restriction of that kind covers the user or their device. */
  async hasRestriction(kind: RestrictionKind, userId: string | null, deviceId?: string | null): Promise<boolean> {
    const targets: Array<[RestrictionTargetType, string]> = [];
    if (userId) {
      targets.push([RestrictionTargetType.USER, userId]);
      targets.push([RestrictionTargetType.PARTNER, userId]);
    }
    if (deviceId) targets.push([RestrictionTargetType.DEVICE, deviceId]);

    for (const [targetType, targetId] of targets) {
      const kinds = await this.activeKinds(targetType, targetId);
      if (kinds.includes(kind)) return true;
    }
    return false;
  }

  private async assertNotRestricted(kind: RestrictionKind, userId: string, deviceId: string | null | undefined, message: string): Promise<void> {
    if (await this.hasRestriction(kind, userId, deviceId)) {
      throw AppException.forbidden(message, ErrorCode.ACCOUNT_RESTRICTED);
    }
  }

  /** Active restriction kinds for one target, cached for 60 s (invalidated on create/lift). */
  private async activeKinds(targetType: RestrictionTargetType, targetId: string): Promise<RestrictionKind[]> {
    const key = restrictionKey(targetType, targetId);
    const cached = await this.redis.getJson<RestrictionKind[]>(key);
    if (cached) return cached;

    const now = new Date();
    const rows = await this.prisma.restriction.findMany({
      where: { targetType, targetId, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { kind: true },
    });
    const kinds = [...new Set(rows.map((r) => r.kind))];
    await this.redis.setJson(key, kinds, RESTRICTION_CACHE_S);
    return kinds;
  }

  private async invalidate(targetType: RestrictionTargetType, targetId: string): Promise<void> {
    await this.redis.del(restrictionKey(targetType, targetId));
  }

  /* ------------------------------------------------------------ listeners */

  @OnEvent('job.cancelled')
  async onJobCancelled(event: JobCancelledEventLike): Promise<void> {
    await this.safely('job.cancelled', async () => {
      const ids = new Set<string>();
      if (event.actorType === 'CUSTOMER' && event.customerId) ids.add(event.customerId);
      if (event.actorType === 'PARTNER' && event.partnerId) ids.add(event.partnerId);
      if (!ids.size && event.actorId) ids.add(event.actorId);
      for (const id of ids) await this.evaluateUser(id);
    });
  }

  @OnEvent('payment.failed')
  async onPaymentFailed(event: PaymentFailedEventLike): Promise<void> {
    await this.safely('payment.failed', async () => {
      const customerId = event.customerId ?? (await this.prisma.job.findUnique({ where: { id: event.jobId }, select: { customerId: true } }))?.customerId;
      if (customerId) await this.evaluateUser(customerId);
    });
  }

  @OnEvent('promo.redeemed')
  async onPromoRedeemed(event: PromoRedeemedEventLike): Promise<void> {
    await this.safely('promo.redeemed', async () => {
      const userId = event.customerId ?? event.userId;
      if (userId) await this.evaluateUser(userId);
    });
  }

  @OnEvent('tracking.impossible_movement')
  async onImpossibleMovement(event: ImpossibleMovementEventLike): Promise<void> {
    await this.safely('tracking.impossible_movement', async () => {
      const userId = event.userId ?? event.partnerId;
      if (!userId) return;
      const thresholds = await this.thresholds();
      const findings = evaluateRiskRules({ ...emptyCounters(), maxObservedSpeedKmh: event.speedKmh }, thresholds);
      for (const finding of findings) {
        await this.recordSignal(userId, finding.signal, finding.score, finding.details, event.jobId ?? null);
      }
    });
  }

  /** A risk listener must never break the pipeline that emitted the event. */
  private async safely(event: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error({ err, event }, 'risk evaluation failed');
    }
  }

  /* ------------------------------------------------------------ counters */

  private async thresholds(): Promise<RiskThresholds> {
    const [maxCancellationsPerDay, maxFailedPaymentsPerDay, maxPromoRedemptionsPerDay, maxSpeedKmh] = await Promise.all([
      this.systemConfig.getNumber(CONFIG_KEYS.RISK_MAX_CANCELLATIONS_PER_DAY),
      this.systemConfig.getNumber(CONFIG_KEYS.RISK_MAX_FAILED_PAYMENTS_PER_DAY),
      this.systemConfig.getNumber(CONFIG_KEYS.RISK_MAX_PROMO_REDEMPTIONS_PER_DAY),
      this.systemConfig.getNumber(CONFIG_KEYS.TRACKING_MAX_SPEED_KMH),
    ]);
    return { maxCancellationsPerDay, maxFailedPaymentsPerDay, maxPromoRedemptionsPerDay, maxSpeedKmh };
  }

  async countersFor(userId: string): Promise<RiskCounters> {
    const dayStart = utcDayStart(new Date());
    const [cancellationsToday, failedPaymentsToday, promoRedemptionsToday, accountsOnDevice, referralsFromSameDevice] = await Promise.all([
      this.prisma.job.count({
        where: {
          cancelledAt: { gte: dayStart },
          OR: [
            { customerId: userId, cancelledBy: 'CUSTOMER' },
            { partnerId: userId, cancelledBy: 'PARTNER' },
          ],
        },
      }),
      this.prisma.payment.count({ where: { customerId: userId, status: 'FAILED', updatedAt: { gte: dayStart } } }),
      this.prisma.promoRedemption.count({ where: { customerId: userId, releasedAt: null, createdAt: { gte: dayStart } } }),
      this.scalarCount(Prisma.sql`
        SELECT COALESCE(MAX(cnt), 0)::int AS count FROM (
          SELECT s.device_id, COUNT(DISTINCT s.user_id) AS cnt
          FROM user_sessions s
          WHERE s.device_id IN (SELECT device_id FROM user_sessions WHERE user_id = ${userId}::uuid)
          GROUP BY 1
        ) x`),
      this.scalarCount(Prisma.sql`
        SELECT COUNT(DISTINCT cp.user_id)::int AS count
        FROM customer_profiles cp
        WHERE cp.referred_by_id = ${userId}::uuid
          AND EXISTS (
            SELECT 1 FROM user_sessions s
            WHERE s.user_id = cp.user_id
              AND s.device_id IN (SELECT device_id FROM user_sessions WHERE user_id = ${userId}::uuid)
          )`),
    ]);

    return {
      cancellationsToday,
      failedPaymentsToday,
      promoRedemptionsToday,
      maxObservedSpeedKmh: null,
      accountsOnDevice,
      referralsFromSameDevice,
    };
  }

  private async scalarCount(sql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(sql);
    return Number(rows[0]?.count ?? 0);
  }
}

/* --------------------------------------------------------------- helpers */

const utcDayStart = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function toSignalDto(row: {
  id: string;
  userId: string;
  signal: RiskSignal;
  score: number;
  details: Prisma.JsonValue;
  jobId: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  createdAt: Date;
}): RiskSignalDto {
  return {
    id: row.id,
    userId: row.userId,
    signal: row.signal,
    score: row.score,
    details: (row.details as Record<string, unknown> | null) ?? null,
    jobId: row.jobId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedById: row.reviewedById,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRestrictionDto(
  row: {
    id: string;
    targetType: RestrictionTargetType;
    targetId: string;
    kind: RestrictionKind;
    reason: string;
    createdById: string;
    expiresAt: Date | null;
    liftedAt: Date | null;
    liftedById: string | null;
    liftReason: string | null;
    createdAt: Date;
  },
  now: Date,
): RestrictionDto {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    kind: row.kind,
    reason: row.reason,
    createdById: row.createdById,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    liftedAt: row.liftedAt ? row.liftedAt.toISOString() : null,
    liftedById: row.liftedById,
    liftReason: row.liftReason,
    isActive: row.liftedAt === null && (row.expiresAt === null || row.expiresAt.getTime() > now.getTime()),
    createdAt: row.createdAt.toISOString(),
  };
}
