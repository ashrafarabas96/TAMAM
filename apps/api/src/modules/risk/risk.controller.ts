import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, RiskSignal } from '@tamam/shared-types';
import { type UpsertRestrictionInput, pageRequestSchema, upsertRestrictionSchema } from '@tamam/validation';
import { z } from 'zod';

import { Audited, CurrentUser, RequestId, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { RiskService } from './risk.service';

const signalListSchema = pageRequestSchema.extend({
  userId: z.string().uuid().optional(),
  signal: z.nativeEnum(RiskSignal).optional(),
  unreviewed: z.coerce.boolean().optional(),
});

const restrictionListSchema = pageRequestSchema.extend({
  targetType: z.enum(['USER', 'PARTNER', 'DEVICE']).optional(),
  targetId: z.string().trim().max(128).optional(),
  kind: z.enum(['BLOCK_JOBS', 'BLOCK_PROMOS', 'BLOCK_WALLET', 'BLOCK_LOGIN', 'REQUIRE_REVIEW']).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

const liftRestrictionSchema = z.object({ reason: z.string().trim().min(5).max(500) });

@ApiTags('risk')
@ApiBearerAuth()
@Controller()
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('admin/risk/signals')
  @RequirePermission(Permission.RISK_READ)
  listSignals(@ZodQuery(signalListSchema) query: z.infer<typeof signalListSchema>) {
    return this.risk.listSignals({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.signal ? { signal: query.signal } : {}),
      ...(query.unreviewed === undefined ? {} : { unreviewed: query.unreviewed }),
    });
  }

  @Post('admin/risk/signals/:id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.RISK_MANAGE)
  @Audited({ action: 'risk.signal.review', entity: 'risk_signal', entityIdFrom: 'id' })
  reviewSignal(@Param('id', UuidPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.risk.reviewSignal(id, user);
  }

  @Get('admin/risk/restrictions')
  @RequirePermission(Permission.RISK_READ)
  listRestrictions(@ZodQuery(restrictionListSchema) query: z.infer<typeof restrictionListSchema>) {
    return this.risk.list({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.activeOnly === undefined ? {} : { activeOnly: query.activeOnly }),
    });
  }

  /** Audited inside the service (inside the same transaction as the write), not by the interceptor. */
  @Post('admin/risk/restrictions')
  @RequirePermission(Permission.RISK_MANAGE)
  createRestriction(@ZodBody(upsertRestrictionSchema) input: UpsertRestrictionInput, @CurrentUser() user: RequestUser, @RequestId() requestId: string) {
    return this.risk.create(input, user, requestId);
  }

  /** Audited inside the service (inside the same transaction as the write), not by the interceptor. */
  @Post('admin/risk/restrictions/:id/lift')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.RISK_MANAGE)
  liftRestriction(
    @Param('id', UuidPipe) id: string,
    @ZodBody(liftRestrictionSchema) body: z.infer<typeof liftRestrictionSchema>,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.risk.lift(id, body.reason, user, requestId);
  }
}
