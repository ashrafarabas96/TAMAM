import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import {
  type ChaletApprovalDecisionInput,
  type ChaletApprovalQueryInput,
  type ChaletSuspensionInput,
  chaletApprovalDecisionSchema,
  chaletApprovalQuerySchema,
  chaletSuspensionSchema,
} from '@tamam/validation';

import { Audited, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';

import { ChaletAdminService } from './chalet-admin.service';

/**
 * The console's side of a chalet (spec §82).
 *
 * A chalet is somebody's property advertised on the platform's word, so it
 * goes live because a person said so. Approving and suspending are audited;
 * reading is not, because a reviewer opening a queue is not an event.
 */
@ApiTags('admin-chalets')
@ApiBearerAuth()
@Controller('admin/chalets')
export class ChaletAdminController {
  constructor(private readonly chalets: ChaletAdminService) {}

  @Get()
  @RequirePermission(Permission.CHALETS_READ)
  list(@ZodQuery(chaletApprovalQuerySchema) query: ChaletApprovalQueryInput) {
    return this.chalets.list(query);
  }

  /** The badge on the console's navigation: how many are waiting. */
  @Get('pending-count')
  @RequirePermission(Permission.CHALETS_READ)
  async pendingCount() {
    return { pending: await this.chalets.pendingCount() };
  }

  @Get(':id')
  @RequirePermission(Permission.CHALETS_READ)
  detail(@Param('id', UuidPipe) chaletId: string) {
    return this.chalets.detail(chaletId);
  }

  /** Approve or reject. A rejection must say why; the schema enforces it. */
  @Patch(':id/approval')
  @RequirePermission(Permission.CHALETS_APPROVE)
  @Audited({ action: 'chalet.approval', entity: 'chalet', entityIdFrom: 'id' })
  decide(
    @Param('id', UuidPipe) chaletId: string,
    @ZodBody(chaletApprovalDecisionSchema) input: ChaletApprovalDecisionInput,
  ) {
    return this.chalets.decide(chaletId, input);
  }

  /** Take a live chalet off the market, or put it back. */
  @Patch(':id/suspension')
  @RequirePermission(Permission.CHALETS_MANAGE)
  @Audited({ action: 'chalet.suspension', entity: 'chalet', entityIdFrom: 'id' })
  suspend(
    @Param('id', UuidPipe) chaletId: string,
    @ZodBody(chaletSuspensionSchema) input: ChaletSuspensionInput,
  ) {
    return this.chalets.setSuspended(chaletId, input);
  }
}
