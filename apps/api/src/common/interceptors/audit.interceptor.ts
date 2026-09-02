import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_KEY, type AuditMeta } from '../decorators/metadata.decorators';
import type { RequestUser } from '../types/request-user';

/** Writes an audit entry after successful handlers decorated with @Audited (spec §85). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser; id?: string }>();
    const entityId = meta.entityIdFrom ? (req.params[meta.entityIdFrom] ?? (req.body as Record<string, unknown> | undefined)?.[meta.entityIdFrom]) : undefined;
    const body = (req.body ?? {}) as Record<string, unknown>;
    return next.handle().pipe(
      tap((result) => {
        void this.audit.record({
          actorId: req.user?.id ?? null,
          actorRole: req.user?.roles.join(',') ?? null,
          action: meta.action,
          entity: meta.entity,
          entityId: typeof entityId === 'string' ? entityId : ((result as { id?: string } | undefined)?.id ?? null),
          newValue: AuditService.redact(body),
          reason: typeof body.reason === 'string' ? body.reason : null,
          ip: req.ip ?? null,
          userAgent: req.header('user-agent') ?? null,
          deviceSessionId: req.user?.sessionId ?? null,
          requestId: req.id ?? null,
        });
      }),
    );
  }
}
