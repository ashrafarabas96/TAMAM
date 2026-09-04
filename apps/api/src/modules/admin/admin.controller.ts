import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, UserRole } from '@tamam/shared-types';
import {
  type AccountStatusActionInput,
  type CreateAdminUserInput,
  type DispatcherJobsFilterInput,
  type UpdateAdminRolesInput,
  accountStatusActionSchema,
  adminSearchSchema,
  createAdminUserSchema,
  dispatcherJobsFilterSchema,
  pageRequestSchema,
  updateAdminRolesSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  Audited,
  CurrentUser,
  RateLimit,
  RequestId,
  RequireAnyPermission,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { AdminOverviewService } from './admin-overview.service';
import { type AdminSearchInput, AdminSearchService } from './admin-search.service';
import { AdminUsersService } from './admin-users.service';
import { DispatcherService } from './dispatcher.service';

const staffListSchema = pageRequestSchema.extend({
  q: z.string().trim().max(60).optional(),
  role: z.nativeEnum(UserRole).optional(),
});
type StaffListQuery = z.infer<typeof staffListSchema>;

/** Sensitive action bodies carry a reason so the audit trail is never empty (spec §85). */
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(500) });
type ReasonBody = z.infer<typeof reasonSchema>;

/**
 * Admin panel entry points that do not belong to a domain module: staff accounts, the unified
 * search box, the dispatcher console and the home overview (spec §139–§142). Every route is
 * permission-guarded; object-level checks stay inside the services.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(
    private readonly staff: AdminUsersService,
    private readonly search: AdminSearchService,
    private readonly dispatcher: DispatcherService,
    private readonly overviewService: AdminOverviewService,
  ) {}

  /* -------------------------------------------------------------- home */
  @Get('admin/overview')
  @RequirePermission(Permission.ANALYTICS_READ)
  overview() {
    return this.overviewService.overview();
  }

  /* ------------------------------------------------------------ search */
  @Get('admin/search')
  @RequireAnyPermission(
    Permission.JOBS_READ_ALL,
    Permission.CUSTOMERS_READ,
    Permission.PARTNERS_READ,
    Permission.PAYMENTS_READ,
    Permission.SUPPORT_READ,
    Permission.DISPUTES_READ,
  )
  @RateLimit({ name: 'admin-search', limit: 120, windowSeconds: 60, keyBy: 'user' })
  globalSearch(
    @ZodQuery(adminSearchSchema) query: AdminSearchInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.search.search(query, user);
  }

  /* -------------------------------------------------------- dispatcher */
  @Get('admin/dispatch/console')
  @RequirePermission(Permission.JOBS_READ_ALL)
  dispatchConsole(
    @ZodQuery(dispatcherJobsFilterSchema) query: DispatcherJobsFilterInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dispatcher.console(query, user);
  }

  @Get('admin/dispatch/partners/:id/timeline')
  @RequirePermission(Permission.JOBS_READ_ALL)
  partnerTimeline(@Param('id', UuidPipe) id: string) {
    return this.dispatcher.partnerTimeline(id);
  }

  /* ------------------------------------------------------------- staff */
  @Get('admin/staff')
  @RequirePermission(Permission.ADMIN_USERS_MANAGE)
  listStaff(@ZodQuery(staffListSchema) query: StaffListQuery) {
    return this.staff.list(query);
  }

  @Get('admin/staff/:id')
  @RequirePermission(Permission.ADMIN_USERS_MANAGE)
  getStaff(@Param('id', UuidPipe) id: string) {
    return this.staff.get(id);
  }

  @Post('admin/staff')
  @RequirePermission(Permission.ADMIN_USERS_MANAGE)
  @Audited({ action: 'admin_user.create', entity: 'user', sensitive: true })
  createStaff(
    @ZodBody(createAdminUserSchema) input: CreateAdminUserInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.staff.create(input, actor, requestId);
  }

  @Patch('admin/staff/:id/roles')
  @RequirePermission(Permission.ROLES_MANAGE)
  @Audited({
    action: 'admin_user.roles_update',
    entity: 'user',
    entityIdFrom: 'id',
    sensitive: true,
  })
  updateStaffRoles(
    @Param('id', UuidPipe) id: string,
    @ZodBody(updateAdminRolesSchema) input: UpdateAdminRolesInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.staff.updateRoles(id, input, actor, requestId);
  }

  /**
   * Issues a one-time temporary password. The value is returned exactly once and every session
   * of the account is revoked, so a leaked panel tab cannot survive the reset.
   */
  @Post('admin/staff/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ADMIN_USERS_MANAGE)
  @RateLimit({ name: 'admin-password-reset', limit: 10, windowSeconds: 3600, keyBy: 'user' })
  @Audited({
    action: 'admin_user.password_reset',
    entity: 'user',
    entityIdFrom: 'id',
    sensitive: true,
  })
  resetStaffPassword(
    @Param('id', UuidPipe) id: string,
    @ZodBody(reasonSchema) body: ReasonBody,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.staff.resetPassword(id, actor, body.reason, requestId);
  }

  @Post('admin/staff/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ADMIN_USERS_MANAGE)
  @Audited({ action: 'admin_user.status', entity: 'user', entityIdFrom: 'id', sensitive: true })
  changeStaffStatus(
    @Param('id', UuidPipe) id: string,
    @ZodBody(accountStatusActionSchema) input: AccountStatusActionInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.staff.changeStatus(id, input, actor, requestId);
  }
}
