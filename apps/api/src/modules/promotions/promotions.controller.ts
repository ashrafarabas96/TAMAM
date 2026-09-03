import { Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentMethod, Permission } from '@tamam/shared-types';
import {
  type ApplyPromoInput,
  type UpsertPromoCodeInput,
  type UpsertReferralProgramInput,
  applyPromoSchema,
  pageRequestSchema,
  upsertPromoCodeSchema,
  upsertReferralProgramSchema,
} from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, Audited, CurrentUser, RateLimit, RequestId, RequirePermission, RequireRole, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { PromotionsService } from './promotions.service';
import { ReferralsService } from './referrals.service';

const validatePromoSchema = applyPromoSchema.extend({ paymentMethod: z.nativeEnum(PaymentMethod).optional() });
type ValidatePromoBody = ApplyPromoInput & { paymentMethod?: PaymentMethod };

const promoListSchema = pageRequestSchema.extend({
  isActive: z.coerce.boolean().optional(),
  q: z.string().trim().max(20).optional(),
});
type PromoListQuery = z.infer<typeof promoListSchema>;

const rewardListSchema = pageRequestSchema.extend({
  status: z.enum(['PENDING', 'GRANTED', 'BLOCKED']).optional(),
  inviterId: z.string().uuid().optional(),
});
type RewardListQuery = z.infer<typeof rewardListSchema>;

@ApiTags('promotions')
@ApiBearerAuth()
@Controller()
export class PromotionsController {
  constructor(
    private readonly promotions: PromotionsService,
    private readonly referrals: ReferralsService,
  ) {}

  /* ------------------------------------------------------------- customer */

  /** Discount preview against a cached fare estimate — nothing is reserved here. */
  @Post('promos/validate')
  @RequireRole('CUSTOMER')
  @RateLimit({ name: 'promos.validate', limit: 30, windowSeconds: 300, keyBy: 'user' })
  validate(@CurrentUser() user: RequestUser, @ZodBody(validatePromoSchema) input: ValidatePromoBody) {
    return this.promotions.previewForEstimate(user.id, input, input.paymentMethod);
  }

  @Get('referrals/me')
  @RequireRole('CUSTOMER')
  @AllowRestricted()
  myReferral(@CurrentUser() user: RequestUser) {
    return this.referrals.getMyCode(user.id);
  }

  /* ---------------------------------------------------------------- admin */

  @Get('admin/promo-codes')
  @RequirePermission(Permission.PROMOS_MANAGE)
  listPromos(@ZodQuery(promoListSchema) query: PromoListQuery) {
    return this.promotions.list(query);
  }

  @Post('admin/promo-codes')
  @RequirePermission(Permission.PROMOS_MANAGE)
  @Audited({ action: 'promo_code.create', entity: 'promo_code' })
  createPromo(@ZodBody(upsertPromoCodeSchema) input: UpsertPromoCodeInput, @CurrentUser() actor: RequestUser, @RequestId() requestId: string) {
    return this.promotions.upsert(input, actor.id, requestId);
  }

  @Put('admin/promo-codes/:id')
  @RequirePermission(Permission.PROMOS_MANAGE)
  @Audited({ action: 'promo_code.update', entity: 'promo_code', entityIdFrom: 'id' })
  updatePromo(
    @Param('id', UuidPipe) id: string,
    @ZodBody(upsertPromoCodeSchema) input: UpsertPromoCodeInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.promotions.upsert(input, actor.id, requestId, id);
  }

  @Get('admin/promo-codes/:id/stats')
  @RequirePermission(Permission.PROMOS_MANAGE)
  promoStats(@Param('id', UuidPipe) id: string) {
    return this.promotions.stats(id);
  }

  @Get('admin/referral-program')
  @RequirePermission(Permission.REFERRALS_MANAGE)
  getProgram() {
    return this.referrals.getProgram();
  }

  @Put('admin/referral-program')
  @RequirePermission(Permission.REFERRALS_MANAGE)
  @Audited({ action: 'referral_program.update', entity: 'referral_program' })
  upsertProgram(
    @ZodBody(upsertReferralProgramSchema) input: UpsertReferralProgramInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.referrals.upsertProgram(input, actor, requestId);
  }

  @Get('admin/referral-rewards')
  @RequirePermission(Permission.REFERRALS_MANAGE)
  listRewards(@ZodQuery(rewardListSchema) query: RewardListQuery) {
    return this.referrals.listRewards(query);
  }
}
