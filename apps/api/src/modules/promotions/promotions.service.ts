import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode, type JobType, type Money, type Page, PaymentMethod, type PromoType } from '@tamam/shared-types';
import type { ApplyPromoInput, UpsertPromoCodeInput } from '@tamam/validation';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { toMoney } from '../../common/utils/money';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { type PromoRule, evaluatePromo } from './domain/promo.rules';

export interface EvaluatePromoContext {
  userId: string;
  jobType: JobType;
  categoryId?: string | null;
  zoneId: string;
  paymentMethod: PaymentMethod;
  /** Fare the discount applies to, before the discount. */
  subtotalMinor: bigint;
  currency: string;
  now?: Date;
}

export interface PromoEvaluationResult {
  promoCodeId: string;
  code: string;
  discountMinor: bigint;
  currency: string;
}

/** Shape PricingService caches under `estimate:<estimateId>` while an estimate is valid. */
export interface CachedEstimate {
  subtotalMinor: number | string;
  currency: string;
  jobType: JobType;
  categoryId?: string | null;
  zoneId: string;
  paymentMethod?: PaymentMethod;
}

export interface PromoPreviewDto {
  promoCodeId: string;
  code: string;
  currency: string;
  subtotal: Money;
  discount: Money;
  total: Money;
}

export interface PromoCodeDto {
  id: string;
  code: string;
  description: string | null;
  type: PromoType;
  value: number;
  maxDiscount: Money | null;
  minOrder: Money;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  jobTypes: JobType[];
  paymentMethods: PaymentMethod[];
  categoryIds: string[];
  zoneIds: string[];
  userIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromoStatsDto {
  promoCodeId: string;
  code: string;
  usageCount: number;
  usageLimit: number | null;
  redemptions: number;
  releasedRedemptions: number;
  uniqueCustomers: number;
  totalDiscount: Money;
}

export interface PromoListFilter {
  isActive?: boolean;
  q?: string;
  cursor?: string;
  limit: number;
}

const promoInclude = { categories: true, zones: true, users: true } satisfies Prisma.PromoCodeInclude;
type PromoRow = Prisma.PromoCodeGetPayload<{ include: typeof promoInclude }>;

/**
 * Promo codes (spec §60). Evaluation is delegated to the pure rules module; this service owns
 * loading, the redemption reservation (atomic against the usage limit) and administration.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  /* ------------------------------------------------------------ evaluation */

  /** Validates a code for one customer and order, returning the discount it would give. */
  async evaluate(code: string, ctx: EvaluatePromoContext): Promise<PromoEvaluationResult> {
    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() }, include: promoInclude });
    if (!promo) throw AppException.badRequest(ErrorCode.PROMO_INVALID, 'This promo code does not exist');

    const [userRedemptions, customer] = await Promise.all([
      this.prisma.promoRedemption.count({ where: { promoCodeId: promo.id, customerId: ctx.userId, releasedAt: null } }),
      this.prisma.customerProfile.findUnique({ where: { userId: ctx.userId }, select: { completedJobs: true, firstJobAt: true } }),
    ]);
    if (!customer) throw AppException.notFound('Customer profile', ctx.userId);

    const result = evaluatePromo(this.toRule(promo), {
      userId: ctx.userId,
      jobType: ctx.jobType,
      categoryId: ctx.categoryId ?? null,
      zoneId: ctx.zoneId,
      paymentMethod: ctx.paymentMethod,
      subtotalMinor: ctx.subtotalMinor,
      currency: ctx.currency,
      isFirstOrder: customer.completedJobs === 0 && customer.firstJobAt === null,
      userRedemptions,
      now: ctx.now ?? new Date(),
    });
    if (!result.ok) throw AppException.badRequest(result.code, 'This promo code cannot be used for this order');

    return { promoCodeId: promo.id, code: promo.code, discountMinor: result.discountMinor, currency: promo.currency };
  }

  /**
   * Discount preview for a cached fare estimate — what the customer sees before confirming.
   * The estimate expires with its Redis key, after which the customer must re-estimate.
   */
  async previewForEstimate(userId: string, input: ApplyPromoInput, paymentMethod?: PaymentMethod): Promise<PromoPreviewDto> {
    const estimate = await this.redis.getJson<CachedEstimate>(`estimate:${input.estimateId}`);
    if (!estimate) throw AppException.notFound('Estimate', input.estimateId);
    const subtotalMinor = BigInt(Math.trunc(Number(estimate.subtotalMinor)));
    if (subtotalMinor < 0n) throw AppException.validation([{ field: 'estimateId', message: 'estimate has no usable total' }]);

    const result = await this.evaluate(input.code, {
      userId,
      jobType: estimate.jobType,
      categoryId: estimate.categoryId ?? null,
      zoneId: estimate.zoneId,
      paymentMethod: paymentMethod ?? estimate.paymentMethod ?? PaymentMethod.CASH,
      subtotalMinor,
      currency: estimate.currency,
    });

    return {
      promoCodeId: result.promoCodeId,
      code: result.code,
      currency: estimate.currency,
      subtotal: toMoney(subtotalMinor, estimate.currency),
      discount: toMoney(result.discountMinor, estimate.currency),
      total: toMoney(subtotalMinor - result.discountMinor, estimate.currency),
    };
  }

  /**
   * Reserves the redemption for a job. The usage counter is incremented with the limit check in
   * the same statement, so a burst of concurrent orders can never overshoot `usageLimit`.
   */
  async reserve(jobId: string, promoCodeId: string, customerId: string, discountMinor: bigint, currency: string, tx: Tx): Promise<void> {
    const existing = await tx.promoRedemption.findUnique({ where: { jobId }, select: { id: true } });
    if (existing) return;

    const claimed = await tx.$executeRaw`
      UPDATE promo_codes
      SET usage_count = usage_count + 1, updated_at = now()
      WHERE id = ${promoCodeId}::uuid AND (usage_limit IS NULL OR usage_count < usage_limit)`;
    if (claimed === 0) throw AppException.badRequest(ErrorCode.PROMO_USAGE_EXCEEDED, 'This promo code has been fully redeemed');

    try {
      await tx.promoRedemption.create({ data: { promoCodeId, customerId, jobId, discountMinor, currency } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Another request reserved the same job first — give the counter back.
        await tx.$executeRaw`UPDATE promo_codes SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = ${promoCodeId}::uuid`;
        return;
      }
      throw err;
    }
  }

  /** Releases a reservation when a job is cancelled so the code can be used again. */
  async release(jobId: string, tx?: Tx): Promise<void> {
    if (!tx) {
      await this.prisma.$transaction((t) => this.release(jobId, t));
      return;
    }
    const redemption = await tx.promoRedemption.findUnique({ where: { jobId }, select: { id: true, promoCodeId: true, releasedAt: true } });
    if (!redemption || redemption.releasedAt) return;
    const released = await tx.promoRedemption.updateMany({ where: { id: redemption.id, releasedAt: null }, data: { releasedAt: new Date() } });
    if (released.count === 0) return;
    await tx.$executeRaw`UPDATE promo_codes SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now() WHERE id = ${redemption.promoCodeId}::uuid`;
    this.logger.info({ jobId, promoCodeId: redemption.promoCodeId }, 'promo redemption released');
  }

  /* ----------------------------------------------------------------- admin */

  async list(filter: PromoListFilter): Promise<Page<PromoCodeDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.promoCode.findMany({
      where: {
        ...cursorWhere(cursor),
        isActive: filter.isActive,
        code: filter.q ? { contains: filter.q.toUpperCase() } : undefined,
      },
      include: promoInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toDto(row));
  }

  async get(id: string): Promise<PromoCodeDto> {
    const promo = await this.prisma.promoCode.findUnique({ where: { id }, include: promoInclude });
    if (!promo) throw AppException.notFound('Promo code', id);
    return this.toDto(promo);
  }

  /**
   * Creates or updates a code. Without `id` the (unique) code string identifies the row, so
   * re-posting the same code edits it instead of failing on the unique index.
   */
  async upsert(input: UpsertPromoCodeInput, actorId: string, requestId: string | null, id?: string): Promise<PromoCodeDto> {
    const code = input.code.toUpperCase();
    const row = await this.prisma.$transaction(async (tx) => {
      const before = id
        ? await tx.promoCode.findUnique({ where: { id }, include: promoInclude })
        : await tx.promoCode.findUnique({ where: { code }, include: promoInclude });
      if (id && !before) throw AppException.notFound('Promo code', id);
      if (id && before && before.code !== code) {
        const clash = await tx.promoCode.findUnique({ where: { code }, select: { id: true } });
        if (clash) throw AppException.conflict(`Promo code ${code} already exists`);
      }
      const data = {
        description: input.description ?? null,
        type: input.type,
        value: new Prisma.Decimal(input.value),
        maxDiscountMinor: input.maxDiscountMinor === undefined || input.maxDiscountMinor === null ? null : BigInt(input.maxDiscountMinor),
        minOrderMinor: BigInt(input.minOrderMinor),
        currency: input.currency,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit,
        firstOrderOnly: input.firstOrderOnly,
        jobTypes: input.jobTypes,
        paymentMethods: input.paymentMethods,
        isActive: input.isActive,
      };
      const promo = before
        ? await tx.promoCode.update({ where: { id: before.id }, data: { ...data, code } })
        : await tx.promoCode.create({ data: { ...data, code, createdById: actorId } });

      await tx.promoCodeCategory.deleteMany({ where: { promoCodeId: promo.id } });
      await tx.promoCodeZone.deleteMany({ where: { promoCodeId: promo.id } });
      await tx.promoCodeUser.deleteMany({ where: { promoCodeId: promo.id } });
      if (input.categoryIds.length) {
        await tx.promoCodeCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ promoCodeId: promo.id, categoryId })) });
      }
      if (input.zoneIds.length) {
        await tx.promoCodeZone.createMany({ data: input.zoneIds.map((zoneId) => ({ promoCodeId: promo.id, zoneId })) });
      }
      if (input.userIds.length) {
        await tx.promoCodeUser.createMany({ data: input.userIds.map((userId) => ({ promoCodeId: promo.id, userId })) });
      }

      await this.audit.record(
        {
          actorId,
          action: before ? 'promo_code.update' : 'promo_code.create',
          entity: 'promo_code',
          entityId: promo.id,
          oldValue: before ? { isActive: before.isActive, value: before.value.toString(), usageLimit: before.usageLimit } : null,
          newValue: { code, type: input.type, value: input.value, isActive: input.isActive, usageLimit: input.usageLimit ?? null },
          requestId,
        },
        tx,
      );
      return tx.promoCode.findUniqueOrThrow({ where: { id: promo.id }, include: promoInclude });
    });
    return this.toDto(row);
  }

  async stats(promoCodeId: string): Promise<PromoStatsDto> {
    const promo = await this.prisma.promoCode.findUnique({ where: { id: promoCodeId }, select: { id: true, code: true, currency: true, usageCount: true, usageLimit: true } });
    if (!promo) throw AppException.notFound('Promo code', promoCodeId);
    const [redemptions, released, totals, customers] = await Promise.all([
      this.prisma.promoRedemption.count({ where: { promoCodeId } }),
      this.prisma.promoRedemption.count({ where: { promoCodeId, releasedAt: { not: null } } }),
      this.prisma.promoRedemption.aggregate({ where: { promoCodeId, releasedAt: null }, _sum: { discountMinor: true } }),
      this.prisma.promoRedemption.groupBy({ by: ['customerId'], where: { promoCodeId, releasedAt: null } }),
    ]);
    return {
      promoCodeId: promo.id,
      code: promo.code,
      usageCount: promo.usageCount,
      usageLimit: promo.usageLimit,
      redemptions,
      releasedRedemptions: released,
      uniqueCustomers: customers.length,
      totalDiscount: toMoney(totals._sum.discountMinor ?? 0n, promo.currency),
    };
  }

  /* --------------------------------------------------------------- mapping */

  private toRule(promo: PromoRow): PromoRule {
    return {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value.toNumber(),
      maxDiscountMinor: promo.maxDiscountMinor,
      minOrderMinor: promo.minOrderMinor,
      currency: promo.currency,
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      usageLimit: promo.usageLimit,
      usageCount: promo.usageCount,
      perUserLimit: promo.perUserLimit,
      firstOrderOnly: promo.firstOrderOnly,
      jobTypes: promo.jobTypes,
      paymentMethods: promo.paymentMethods,
      isActive: promo.isActive,
      categoryIds: promo.categories.map((c) => c.categoryId),
      zoneIds: promo.zones.map((z) => z.zoneId),
      userIds: promo.users.map((u) => u.userId),
    };
  }

  toDto(promo: PromoRow): PromoCodeDto {
    return {
      id: promo.id,
      code: promo.code,
      description: promo.description,
      type: promo.type,
      value: promo.value.toNumber(),
      maxDiscount: promo.maxDiscountMinor === null ? null : toMoney(promo.maxDiscountMinor, promo.currency),
      minOrder: toMoney(promo.minOrderMinor, promo.currency),
      currency: promo.currency,
      startsAt: promo.startsAt.toISOString(),
      endsAt: promo.endsAt ? promo.endsAt.toISOString() : null,
      usageLimit: promo.usageLimit,
      usageCount: promo.usageCount,
      perUserLimit: promo.perUserLimit,
      firstOrderOnly: promo.firstOrderOnly,
      jobTypes: promo.jobTypes,
      paymentMethods: promo.paymentMethods,
      categoryIds: promo.categories.map((c) => c.categoryId),
      zoneIds: promo.zones.map((z) => z.zoneId),
      userIds: promo.users.map((u) => u.userId),
      isActive: promo.isActive,
      createdAt: promo.createdAt.toISOString(),
      updatedAt: promo.updatedAt.toISOString(),
    };
  }
}
