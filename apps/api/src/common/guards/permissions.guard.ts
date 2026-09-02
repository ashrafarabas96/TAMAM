import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@tamam/shared-types';
import type { Request } from 'express';

import { ANY_PERMISSION_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators/metadata.decorators';
import { AppException } from '../errors/app.exception';
import type { RequestUser } from '../types/request-user';

/** Permission-based authorization (spec §9, §142). Roles are only a coarse pre-filter. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const anyOf = this.reflector.getAllAndOverride<Permission[] | undefined>(ANY_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length && !anyOf?.length && !roles?.length) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    if (!user) throw AppException.unauthenticated();
    if (user.isSuperAdmin) return true;

    if (roles?.length && !roles.some((r) => user.roles.includes(r as RequestUser['roles'][number]))) {
      throw AppException.forbidden();
    }
    if (required?.length) {
      const missing = required.filter((p) => !user.permissions.includes(p));
      if (missing.length) throw AppException.forbidden(`Missing permission: ${missing.join(', ')}`);
    }
    if (anyOf?.length && !anyOf.some((p) => user.permissions.includes(p))) {
      throw AppException.forbidden();
    }
    return true;
  }
}
