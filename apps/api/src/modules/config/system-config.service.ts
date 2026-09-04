import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONFIG_DEFINITIONS,
  type ConfigKey,
  ErrorCode,
  FEATURE_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagDto,
  type FeatureFlagKey,
  type SystemConfigDto,
} from '@tamam/shared-types';
import type { UpdateConfigInput, UpdateFeatureFlagInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';

const CACHE_KEY = 'cfg:all';
const FLAGS_KEY = 'cfg:flags';
const CACHE_TTL = 30; // seconds — admin changes propagate within half a minute on every node

interface FlagRollout {
  zoneIds: string[];
  percent: number;
  userIds: string[];
}

/**
 * Runtime configuration with safe bounds (spec §84, §177) and feature flags with
 * rollout rules (spec §83, §178). Values are seeded from CONFIG_DEFINITIONS and cached in Redis.
 */
@Injectable()
export class SystemConfigService implements OnModuleInit {
  private local = new Map<string, number | string | boolean>();
  private localFlags = new Map<string, { enabled: boolean; rollout: FlagRollout | null }>();
  private localLoadedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
    await this.refresh();
  }

  /** Inserts any missing keys/flags — idempotent, safe on every boot. */
  async ensureDefaults(): Promise<void> {
    for (const def of CONFIG_DEFINITIONS) {
      await this.prisma.systemConfig.upsert({
        where: { key: def.key },
        update: {
          description: def.description,
          min: def.min ?? null,
          max: def.max ?? null,
          unit: def.unit ?? null,
          group: def.group,
          type: def.type,
        },
        create: {
          key: def.key,
          value: def.default as Prisma.InputJsonValue,
          type: def.type,
          description: def.description,
          min: def.min ?? null,
          max: def.max ?? null,
          unit: def.unit ?? null,
          group: def.group,
        },
      });
    }
    for (const [key, def] of Object.entries(FEATURE_FLAG_DEFAULTS)) {
      await this.prisma.featureFlag.upsert({
        where: { key },
        update: { description: def.description },
        create: { key, description: def.description, enabled: def.enabled },
      });
    }
  }

  async refresh(): Promise<void> {
    const [configs, flags] = await Promise.all([
      this.prisma.systemConfig.findMany(),
      this.prisma.featureFlag.findMany(),
    ]);
    const cfg: Record<string, number | string | boolean> = {};
    for (const c of configs) cfg[c.key] = c.value as number | string | boolean;
    const fl: Record<string, { enabled: boolean; rollout: FlagRollout | null }> = {};
    for (const f of flags)
      fl[f.key] = { enabled: f.enabled, rollout: (f.rollout as FlagRollout | null) ?? null };
    await Promise.all([
      this.redis.setJson(CACHE_KEY, cfg, CACHE_TTL * 4),
      this.redis.setJson(FLAGS_KEY, fl, CACHE_TTL * 4),
    ]);
    this.local = new Map(Object.entries(cfg));
    this.localFlags = new Map(Object.entries(fl));
    this.localLoadedAt = Date.now();
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.localLoadedAt < CACHE_TTL * 1000) return;
    const [cfg, fl] = await Promise.all([
      this.redis.getJson<Record<string, number | string | boolean>>(CACHE_KEY),
      this.redis.getJson<Record<string, { enabled: boolean; rollout: FlagRollout | null }>>(
        FLAGS_KEY,
      ),
    ]);
    if (cfg && fl) {
      this.local = new Map(Object.entries(cfg));
      this.localFlags = new Map(Object.entries(fl));
      this.localLoadedAt = Date.now();
    } else {
      await this.refresh();
    }
  }

  async getNumber(key: ConfigKey): Promise<number> {
    await this.ensureFresh();
    const v = this.local.get(key);
    if (typeof v === 'number') return v;
    const def = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (def && typeof def.default === 'number') return def.default;
    throw new Error(`config ${key} is not a number`);
  }

  async getBoolean(key: ConfigKey): Promise<boolean> {
    await this.ensureFresh();
    const v = this.local.get(key);
    if (typeof v === 'boolean') return v;
    const def = CONFIG_DEFINITIONS.find((d) => d.key === key);
    return def ? Boolean(def.default) : false;
  }

  async getMany(keys: ConfigKey[]): Promise<Record<string, number | string | boolean>> {
    await this.ensureFresh();
    const out: Record<string, number | string | boolean> = {};
    for (const k of keys) {
      const v = this.local.get(k);
      const def = CONFIG_DEFINITIONS.find((d) => d.key === k);
      out[k] = v ?? def?.default ?? '';
    }
    return out;
  }

  async listConfigs(): Promise<SystemConfigDto[]> {
    const rows = await this.prisma.systemConfig.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return rows.map((r) => ({
      key: r.key,
      value: r.value as number | string | boolean,
      type: r.type as SystemConfigDto['type'],
      description: r.description,
      min: r.min === null ? null : Number(r.min),
      max: r.max === null ? null : Number(r.max),
      unit: r.unit,
      group: r.group,
      updatedAt: r.updatedAt.toISOString(),
      updatedBy: r.updatedById,
    }));
  }

  async updateConfig(
    input: UpdateConfigInput,
    actorId: string,
    requestId: string | null,
  ): Promise<SystemConfigDto> {
    const def = CONFIG_DEFINITIONS.find((d) => d.key === input.key);
    if (!def) throw AppException.notFound('Config key', input.key);
    if (def.type === 'number' && typeof input.value === 'number') {
      if (
        (def.min !== undefined && input.value < def.min) ||
        (def.max !== undefined && input.value > def.max)
      ) {
        throw AppException.badRequest(
          ErrorCode.CONFIG_OUT_OF_RANGE,
          `${input.key} must be between ${def.min} and ${def.max}`,
        );
      }
    }
    const before = await this.prisma.systemConfig.findUnique({ where: { key: input.key } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.systemConfig.update({
        where: { key: input.key },
        data: { value: input.value as Prisma.InputJsonValue, updatedById: actorId },
      });
      await this.audit.record(
        {
          actorId,
          action: 'config.update',
          entity: 'system_config',
          entityId: input.key,
          oldValue: { value: before?.value },
          newValue: { value: input.value },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return row;
    });
    await this.refresh();
    return {
      key: updated.key,
      value: updated.value as number | string | boolean,
      type: updated.type as SystemConfigDto['type'],
      description: updated.description,
      min: updated.min === null ? null : Number(updated.min),
      max: updated.max === null ? null : Number(updated.max),
      unit: updated.unit,
      group: updated.group,
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: updated.updatedById,
    };
  }

  /* ------------------------------------------------------------ flags */
  async isEnabled(
    flag: FeatureFlagKey,
    context?: { userId?: string; zoneId?: string | null },
  ): Promise<boolean> {
    await this.ensureFresh();
    const f = this.localFlags.get(flag);
    if (!f) return FEATURE_FLAG_DEFAULTS[flag]?.enabled ?? false;
    if (!f.enabled) return false;
    if (!f.rollout) return true;
    if (context?.userId && f.rollout.userIds.includes(context.userId)) return true;
    if (
      f.rollout.zoneIds.length &&
      (!context?.zoneId || !f.rollout.zoneIds.includes(context.zoneId))
    )
      return false;
    if (f.rollout.percent < 100) {
      if (!context?.userId) return false;
      return this.bucket(`${flag}:${context.userId}`) < f.rollout.percent;
    }
    return true;
  }

  async assertEnabled(
    flag: FeatureFlagKey,
    context?: { userId?: string; zoneId?: string | null },
  ): Promise<void> {
    if (!(await this.isEnabled(flag, context))) throw AppException.featureDisabled(flag);
  }

  /** Deterministic 0-99 bucket for percentage rollouts (FNV-1a). */
  private bucket(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h % 100;
  }

  /**
   * Every flag the platform declares, not merely the ones a seed happened to write.
   * FEATURE_FLAGS is the catalogue; a declared flag with no row yet is reported at its
   * documented default so the console can list and toggle it instead of pretending it does
   * not exist. A stored row that is no longer declared is still listed, so an obsolete flag
   * is visible rather than silently ignored.
   */
  async listFlags(): Promise<FeatureFlagDto[]> {
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    const byKey = new Map(rows.map((r) => [r.key, r] as const));
    const declared = Object.values(FEATURE_FLAGS) as FeatureFlagKey[];
    const keys = [...new Set([...declared, ...rows.map((r) => r.key)])].sort();
    return keys.map((key) => {
      const row = byKey.get(key);
      if (row)
        return {
          key: row.key,
          description: row.description,
          enabled: row.enabled,
          rollout: (row.rollout as FeatureFlagDto['rollout']) ?? null,
          updatedAt: row.updatedAt.toISOString(),
        };
      const fallback = FEATURE_FLAG_DEFAULTS[key as FeatureFlagKey];
      return {
        key,
        description: fallback?.description ?? '',
        enabled: fallback?.enabled ?? false,
        rollout: null,
        updatedAt: new Date(0).toISOString(),
      };
    });
  }

  async updateFlag(
    key: string,
    input: UpdateFeatureFlagInput,
    actorId: string,
    requestId: string | null,
  ): Promise<FeatureFlagDto> {
    if (!Object.values(FEATURE_FLAGS).includes(key as FeatureFlagKey))
      throw AppException.notFound('Feature flag', key);
    const before = await this.prisma.featureFlag.findUnique({ where: { key } });
    const row = await this.prisma.$transaction(async (tx) => {
      // Upsert, not update: a declared flag that no seed has written yet has no row, and
      // toggling it must create one rather than fail with a record-not-found.
      const updated = await tx.featureFlag.upsert({
        where: { key },
        update: {
          enabled: input.enabled,
          rollout:
            input.rollout === undefined
              ? undefined
              : ((input.rollout ?? Prisma.JsonNull) as Prisma.InputJsonValue),
          updatedById: actorId,
        },
        create: {
          key,
          description: FEATURE_FLAG_DEFAULTS[key as FeatureFlagKey]?.description ?? '',
          enabled: input.enabled,
          rollout: (input.rollout ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          updatedById: actorId,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'feature_flag.update',
          entity: 'feature_flag',
          entityId: key,
          oldValue: { enabled: before?.enabled, rollout: before?.rollout },
          newValue: { enabled: input.enabled, rollout: input.rollout },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return updated;
    });
    await this.refresh();
    return {
      key: row.key,
      description: row.description,
      enabled: row.enabled,
      rollout: (row.rollout as FeatureFlagDto['rollout']) ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Public, cacheable snapshot for mobile apps (no rollout internals leaked). */
  async publicFlags(userId?: string, zoneId?: string | null): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const key of Object.values(FEATURE_FLAGS))
      out[key] = await this.isEnabled(key, { userId, zoneId });
    return out;
  }
}
