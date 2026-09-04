import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import { RATE_LIMIT_KEY, type RateLimitPolicy } from '../decorators/metadata.decorators';
import { AppException } from '../errors/app.exception';
import type { RequestUser } from '../types/request-user';

/** Per-endpoint policies (spec §185): different limits for login, OTP, search, job creation, messages, tracking. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policy) return true;
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const key = this.resolveKey(policy, req);
    const result = await this.limiter.hit(
      `${policy.name}:${key}`,
      policy.limit,
      policy.windowSeconds,
    );
    const res = context.switchToHttp().getResponse<{ setHeader(k: string, v: string): void }>();
    res.setHeader('X-RateLimit-Limit', String(policy.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
    if (!result.allowed) throw AppException.rateLimited(result.retryAfterSeconds);
    return true;
  }

  private resolveKey(policy: RateLimitPolicy, req: Request & { user?: RequestUser }): string {
    const ip = req.ip ?? 'unknown-ip';
    if (policy.keyBy === 'ip') return `ip:${ip}`;
    if (policy.keyBy === 'user') return req.user ? `u:${req.user.id}` : `ip:${ip}`;
    if (policy.keyBy === 'user-or-ip') return req.user ? `u:${req.user.id}` : `ip:${ip}`;
    const field = policy.keyBy.body;
    const value = (req.body as Record<string, unknown> | undefined)?.[field];
    return typeof value === 'string' && value.length < 200 ? `${field}:${value}` : `ip:${ip}`;
  }
}
