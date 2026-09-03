import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditLogDto, Page } from '@tamam/shared-types';
import type { AuditListFilterInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';

export interface AuditEntryInput {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceSessionId?: string | null;
  requestId?: string | null;
}

const REDACT_KEYS = /password|secret|token|otp|pin|iban|card|cvv|nationalid|national_id/i;

/** Append-only audit writer (spec §85). Failures are logged, never thrown into the request path. */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {}

  static redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => AuditService.redact(v));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = REDACT_KEYS.test(k) ? '[REDACTED]' : AuditService.redact(v);
      return out;
    }
    return value;
  }

  async record(entry: AuditEntryInput, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          actorId: entry.actorId,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          oldValue: entry.oldValue === undefined ? undefined : (AuditService.redact(entry.oldValue) as Prisma.InputJsonValue),
          newValue: entry.newValue === undefined ? undefined : (AuditService.redact(entry.newValue) as Prisma.InputJsonValue),
          reason: entry.reason ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          deviceSessionId: entry.deviceSessionId ?? null,
          requestId: entry.requestId ?? null,
        },
      });
    } catch (err) {
      this.logger.error({ err, action: entry.action, entity: entry.entity }, 'audit write failed');
      if (tx) throw err; // inside a transaction, audit failure must roll back the sensitive action
    }
  }

  async list(filter: AuditListFilterInput): Promise<Page<AuditLogDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...cursorWhere(cursor),
        actorId: filter.actorId,
        entity: filter.entity,
        entityId: filter.entityId,
        action: filter.action ? { startsWith: filter.action } : undefined,
        createdAt: filter.from || filter.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (r) => ({
      id: r.id,
      actorId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      oldValue: (r.oldValue as Record<string, unknown> | null) ?? null,
      newValue: (r.newValue as Record<string, unknown> | null) ?? null,
      reason: r.reason,
      ip: r.ip,
      deviceSessionId: r.deviceSessionId,
      requestId: r.requestId,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
