import { Injectable } from '@nestjs/common';
import { type CommissionPolicy, Prisma } from '@prisma/client';
import { CONFIG_KEYS, CommissionScope, type JobType } from '@tamam/shared-types';
import type { UpsertCommissionPolicyInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';

export interface CommissionContext {
  jobType: JobType;
  categoryId?: string | null;
  zoneId?: string | null;
  partnerId?: string | null;
  /** Campaign code carried by the job (banner attribution); enables CAMPAIGN-scoped policies. */
  campaignCode?: string | null;
  at: Date;
}

export interface ResolvedCommission {
  percent: number;
  fixedMinor: bigint;
  policyId: string | null;
}

export interface CommissionPolicyDto {
  id: string;
  scope: CommissionScope;
  jobType: JobType | null;
  categoryId: string | null;
  zoneId: string | null;
  partnerId: string | null;
  campaignCode: string | null;
  percent: number;
  fixedMinor: bigint;
  priority: number;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** More specific scopes win when two policies share the same priority (spec §57). */
const SCOPE_RANK: Record<CommissionScope, number> = {
  [CommissionScope.PARTNER]: 60,
  [CommissionScope.CAMPAIGN]: 50,
  [CommissionScope.CATEGORY]: 40,
  [CommissionScope.ZONE]: 30,
  [CommissionScope.JOB_TYPE]: 20,
  [CommissionScope.GLOBAL]: 10,
};

type PolicyRow = CommissionPolicy;

/**
 * Commission policy resolution and administration (spec §57). Jobs freeze the resolved
 * percentage into their pricing snapshot, so changing a policy never re-prices past jobs.
 */
@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Highest-priority active policy matching the context, falling back to the configured default. */
  async resolve(ctx: CommissionContext, tx?: Tx): Promise<ResolvedCommission> {
    const client = tx ?? this.prisma;
    const scopeMatchers: Prisma.CommissionPolicyWhereInput[] = [
      { scope: CommissionScope.GLOBAL },
      { scope: CommissionScope.JOB_TYPE, jobType: ctx.jobType },
    ];
    if (ctx.categoryId)
      scopeMatchers.push({ scope: CommissionScope.CATEGORY, categoryId: ctx.categoryId });
    if (ctx.zoneId) scopeMatchers.push({ scope: CommissionScope.ZONE, zoneId: ctx.zoneId });
    if (ctx.partnerId)
      scopeMatchers.push({ scope: CommissionScope.PARTNER, partnerId: ctx.partnerId });
    if (ctx.campaignCode)
      scopeMatchers.push({ scope: CommissionScope.CAMPAIGN, campaignCode: ctx.campaignCode });

    const candidates = await client.commissionPolicy.findMany({
      where: {
        isActive: true,
        validFrom: { lte: ctx.at },
        AND: [{ OR: [{ validTo: null }, { validTo: { gt: ctx.at } }] }, { OR: scopeMatchers }],
      },
      orderBy: [{ priority: 'desc' }, { validFrom: 'desc' }],
    });

    const winner = this.pickWinner(candidates);
    if (!winner) {
      return {
        percent: await this.config.getNumber(CONFIG_KEYS.COMMISSION_DEFAULT_PERCENT),
        fixedMinor: 0n,
        policyId: null,
      };
    }
    return {
      percent: winner.percent.toNumber(),
      fixedMinor: winner.fixedMinor,
      policyId: winner.id,
    };
  }

  private pickWinner(candidates: PolicyRow[]): PolicyRow | null {
    let best: PolicyRow | null = null;
    for (const candidate of candidates) {
      if (!best) {
        best = candidate;
        continue;
      }
      if (candidate.priority > best.priority) {
        best = candidate;
        continue;
      }
      if (candidate.priority < best.priority) continue;
      const candidateRank = SCOPE_RANK[candidate.scope] ?? 0;
      const bestRank = SCOPE_RANK[best.scope] ?? 0;
      if (candidateRank > bestRank) {
        best = candidate;
        continue;
      }
      if (candidateRank === bestRank && candidate.validFrom > best.validFrom) best = candidate;
    }
    return best;
  }

  /* ---------------------------------------------------------------- admin */

  async list(includeInactive = true): Promise<CommissionPolicyDto[]> {
    const rows = await this.prisma.commissionPolicy.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Creates or replaces the policy for a scope target. There is at most one policy per
   * (scope, target) so admins never have to hunt for duplicated rules.
   */
  async upsert(
    input: UpsertCommissionPolicyInput,
    actorId: string,
    requestId: string | null,
  ): Promise<CommissionPolicyDto> {
    const target = this.resolveTarget(input);
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.commissionPolicy.findFirst({
        where: {
          scope: input.scope,
          jobType: target.jobType,
          categoryId: target.categoryId,
          zoneId: target.zoneId,
          partnerId: target.partnerId,
          campaignCode: target.campaignCode,
        },
        orderBy: { createdAt: 'desc' },
      });
      const data = {
        scope: input.scope,
        ...target,
        percent: new Prisma.Decimal(input.percent),
        fixedMinor: BigInt(input.fixedMinor),
        priority: input.priority,
        validFrom: new Date(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo) : null,
        isActive: input.isActive,
      };
      const saved = existing
        ? await tx.commissionPolicy.update({ where: { id: existing.id }, data })
        : await tx.commissionPolicy.create({ data: { ...data, createdById: actorId } });
      await this.audit.record(
        {
          actorId,
          action: existing ? 'commission_policy.update' : 'commission_policy.create',
          entity: 'commission_policy',
          entityId: saved.id,
          oldValue: existing
            ? {
                percent: existing.percent.toString(),
                fixedMinor: existing.fixedMinor.toString(),
                priority: existing.priority,
                isActive: existing.isActive,
              }
            : null,
          newValue: {
            scope: input.scope,
            percent: input.percent,
            fixedMinor: input.fixedMinor,
            priority: input.priority,
            isActive: input.isActive,
          },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return saved;
    });
    return this.toDto(row);
  }

  private resolveTarget(input: UpsertCommissionPolicyInput): {
    jobType: JobType | null;
    categoryId: string | null;
    zoneId: string | null;
    partnerId: string | null;
    campaignCode: string | null;
  } {
    const empty = {
      jobType: null,
      categoryId: null,
      zoneId: null,
      partnerId: null,
      campaignCode: null,
    };
    const requireId = (): string => {
      if (!input.scopeId)
        throw AppException.validation([
          { field: 'scopeId', message: `scopeId is required for scope ${input.scope}` },
        ]);
      return input.scopeId;
    };
    const requireCode = (): string => {
      if (!input.scopeCode)
        throw AppException.validation([
          { field: 'scopeCode', message: `scopeCode is required for scope ${input.scope}` },
        ]);
      return input.scopeCode;
    };
    switch (input.scope) {
      case CommissionScope.GLOBAL:
        return empty;
      case CommissionScope.JOB_TYPE:
        return { ...empty, jobType: requireCode() as JobType };
      case CommissionScope.CATEGORY:
        return { ...empty, categoryId: requireId() };
      case CommissionScope.ZONE:
        return { ...empty, zoneId: requireId() };
      case CommissionScope.PARTNER:
        return { ...empty, partnerId: requireId() };
      case CommissionScope.CAMPAIGN:
        return { ...empty, campaignCode: requireCode() };
      default:
        throw AppException.validation([
          { field: 'scope', message: `unsupported scope ${String(input.scope)}` },
        ]);
    }
  }

  toDto(row: PolicyRow): CommissionPolicyDto {
    return {
      id: row.id,
      scope: row.scope,
      jobType: row.jobType,
      categoryId: row.categoryId,
      zoneId: row.zoneId,
      partnerId: row.partnerId,
      campaignCode: row.campaignCode,
      percent: row.percent.toNumber(),
      fixedMinor: row.fixedMinor,
      priority: row.priority,
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo ? row.validTo.toISOString() : null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
