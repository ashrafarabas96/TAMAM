import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, type UserDto } from '@tamam/shared-types';
import {
  type AccountStatusActionInput,
  type CustomerListFilterInput,
  type UpdateProfileInput,
  type UpdatePushTokenInput,
  accountStatusActionSchema,
  customerListFilterSchema,
  updateProfileSchema,
  updatePushTokenSchema,
} from '@tamam/validation';

import {
  AllowRestricted,
  Audited,
  CurrentUser,
  RequestId,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { SessionService } from '../auth/session.service';

import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  @Get('me')
  @AllowRestricted()
  async me(@CurrentUser() user: RequestUser): Promise<UserDto> {
    // The principal's permissions are resolved from the live role bundles on every request,
    // so echoing them here is both free and exactly what the guards will enforce. Without
    // it a client has to re-derive the set from role names and drifts when a role is edited.
    return { ...(await this.users.findById(user.id)), permissions: user.permissions };
  }

  @Patch('me')
  @AllowRestricted()
  updateMe(
    @CurrentUser() user: RequestUser,
    @ZodBody(updateProfileSchema) input: UpdateProfileInput,
  ) {
    return this.users.updateProfile(user.id, input);
  }

  @Post('me/push-token')
  @AllowRestricted()
  async pushToken(
    @CurrentUser() user: RequestUser,
    @ZodBody(updatePushTokenSchema) input: UpdatePushTokenInput,
  ) {
    await this.users.upsertPushToken(user.id, input);
    return { ok: true };
  }

  @Get('me/sessions')
  @AllowRestricted()
  sessionsList(@CurrentUser() user: RequestUser) {
    return this.users.listSessions(user.id, user.sessionId);
  }

  @Delete('me/sessions/:id')
  @AllowRestricted()
  async revokeSession(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    await this.sessions.revoke(user.id, id, 'user_revoked');
    return { ok: true };
  }

  /* --------------------------------------------------------------- admin */
  @Get('admin/customers')
  @RequirePermission(Permission.CUSTOMERS_READ)
  listCustomers(@ZodQuery(customerListFilterSchema) filter: CustomerListFilterInput) {
    return this.users.listCustomers(filter);
  }

  @Get('admin/users/:id')
  @RequirePermission(Permission.CUSTOMERS_READ)
  getUser(@Param('id', UuidPipe) id: string) {
    return this.users.findById(id);
  }

  @Post('admin/users/:id/status')
  @RequirePermission(Permission.CUSTOMERS_SUSPEND)
  @Audited({ action: 'user.status', entity: 'user', entityIdFrom: 'id', sensitive: true })
  changeStatus(
    @Param('id', UuidPipe) id: string,
    @ZodBody(accountStatusActionSchema) input: AccountStatusActionInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.users.changeAccountStatus(id, input, actor.id, requestId);
  }
}
