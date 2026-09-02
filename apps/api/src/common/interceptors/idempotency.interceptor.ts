import { createHash } from 'node:crypto';

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, Headers } from '@tamam/shared-types';
import type { Request, Response } from 'express';
import { type Observable, from, of, switchMap, tap } from 'rxjs';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IDEMPOTENT_KEY } from '../decorators/metadata.decorators';
import { AppException } from '../errors/app.exception';
import type { RequestUser } from '../types/request-user';
import { toJsonSafe } from './serialize.interceptor';

const TTL_HOURS = 24;

/**
 * Idempotency for sensitive POSTs (spec §102/§53).
 *  - Header `Idempotency-Key` is mandatory on endpoints decorated with @Idempotent(scope).
 *  - Key is namespaced by user; the request body hash is stored to detect key reuse with
 *    a different payload (→ IDEMPOTENCY_KEY_REUSED).
 *  - While the first request is in flight a second one gets 409 (lockedAt without completedAt).
 *  - Completed responses are replayed verbatim with `Idempotent-Replayed: true`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scope = this.reflector.getAllAndOverride<string | undefined>(IDEMPOTENT_KEY, [context.getHandler(), context.getClass()]);
    if (!scope) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const header = req.header(Headers.IDEMPOTENCY_KEY);
    if (!header || header.length < 8 || header.length > 128) {
      throw AppException.badRequest(ErrorCode.IDEMPOTENCY_KEY_REQUIRED, `${Headers.IDEMPOTENCY_KEY} header (8-128 chars) is required`);
    }
    const principal = req.user?.id ?? req.ip ?? 'anonymous';
    const key = `${principal}:${scope}:${header}`;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    return from(this.acquire(key, scope, requestHash)).pipe(
      switchMap((existing) => {
        if (existing) {
          res.setHeader('Idempotent-Replayed', 'true');
          res.status(existing.statusCode);
          return of(existing.body);
        }
        return next.handle().pipe(
          tap({
            next: (body) => void this.complete(key, res.statusCode || 201, toJsonSafe(body)),
            error: () => void this.release(key),
          }),
        );
      }),
    );
  }

  private async acquire(key: string, scope: string, requestHash: string): Promise<{ statusCode: number; body: unknown } | null> {
    const now = new Date();
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.expiresAt < now) {
        await this.prisma.idempotencyKey.delete({ where: { key } });
      } else if (existing.requestHash !== requestHash) {
        throw AppException.conflict('Idempotency-Key was already used with a different payload', ErrorCode.IDEMPOTENCY_KEY_REUSED);
      } else if (existing.completedAt && existing.statusCode !== null) {
        return { statusCode: existing.statusCode, body: existing.responseBody };
      } else {
        throw AppException.conflict('A request with this Idempotency-Key is still being processed', ErrorCode.CONFLICT);
      }
    }
    try {
      await this.prisma.idempotencyKey.create({
        data: { key, scope, requestHash, lockedAt: now, expiresAt: new Date(now.getTime() + TTL_HOURS * 3600 * 1000) },
      });
    } catch {
      // lost the race to another concurrent request holding the same key
      throw AppException.conflict('A request with this Idempotency-Key is still being processed', ErrorCode.CONFLICT);
    }
    return null;
  }

  private async complete(key: string, statusCode: number, body: unknown): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: { statusCode, responseBody: body as object, completedAt: new Date() },
    });
  }

  private async release(key: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({ where: { key, completedAt: null } });
  }
}
