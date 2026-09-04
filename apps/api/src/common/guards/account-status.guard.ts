import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatus, ErrorCode } from '@tamam/shared-types';
import type { Request } from 'express';

import { ALLOW_RESTRICTED_KEY, IS_PUBLIC_KEY } from '../decorators/metadata.decorators';
import { AppException } from '../errors/app.exception';
import type { RequestUser } from '../types/request-user';

/** SUSPENDED accounts are blocked everywhere; RESTRICTED accounts only reach @AllowRestricted endpoints and GETs. */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    if (!user) return true; // public route or unauthenticated (handled by JwtAuthGuard)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw AppException.forbidden(
        'Your account is suspended. Contact support.',
        ErrorCode.ACCOUNT_SUSPENDED,
      );
    }
    if (user.accountStatus === AccountStatus.RESTRICTED) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_RESTRICTED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed && req.method !== 'GET') {
        throw AppException.forbidden(
          'Your account is restricted from this action. Contact support.',
          ErrorCode.ACCOUNT_RESTRICTED,
        );
      }
    }
    return true;
  }
}
