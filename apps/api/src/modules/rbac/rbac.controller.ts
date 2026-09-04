import { Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type UpsertRoleInput, upsertRoleSchema } from '@tamam/validation';

import { CurrentUser, RequestId, RequirePermission, ZodBody } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-user';

import { RbacService } from './rbac.service';

@ApiTags('admin/rbac')
@ApiBearerAuth()
@Controller('admin/rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermission(Permission.ROLES_MANAGE)
  roles() {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @RequirePermission(Permission.ROLES_MANAGE)
  permissions() {
    return this.rbac.listPermissions();
  }

  @Put('roles')
  @RequirePermission(Permission.ROLES_MANAGE)
  upsert(
    @ZodBody(upsertRoleSchema) input: UpsertRoleInput,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.rbac.upsertRole(input, user.id, requestId);
  }
}
