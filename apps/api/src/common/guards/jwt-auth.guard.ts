import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatus, ErrorCode } from '@tamam/shared-types';
import type { Request } from 'express';

import { TokenService } from '../../modules/auth/token.service';
import { IS_PUBLIC_KEY } from '../decorators/metadata.decorators';
import { AppException } from '../errors/app.exception';
import type { RequestUser } from '../types/request-user';

/**
 * Verifies the Bearer access token, resolves the principal (roles, permissions,
 * account status, profiles) and attaches it as `req.user`.
 * Session revocation is enforced via TokenService.resolvePrincipal (Redis-backed check).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      if (isPublic) return true;
      throw AppException.unauthenticated();
    }

    const principal = await this.tokens.resolvePrincipal(token);
    if (!principal) {
      if (isPublic) return true;
      throw AppException.unauthenticated('Session is invalid or expired', ErrorCode.TOKEN_EXPIRED);
    }
    if (principal.accountStatus === AccountStatus.DELETED) {
      throw AppException.unauthenticated('Account no longer exists');
    }
    req.user = principal;
    return true;
  }
}
