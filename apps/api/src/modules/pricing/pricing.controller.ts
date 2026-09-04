import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobType, Permission } from '@tamam/shared-types';
import {
  type DeliveryEstimateInput,
  type RideEstimateInput,
  type ServiceEstimateInput,
  type SurgeOverrideInput,
  type UpsertCancellationPolicyInput,
  type UpsertPricingRuleInput,
  deliveryEstimateSchema,
  rideEstimateSchema,
  serviceEstimateSchema,
  surgeOverrideSchema,
  upsertCancellationPolicySchema,
  upsertPricingRuleSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AcceptLanguage,
  CurrentUser,
  RateLimit,
  RequestId,
  RequirePermission,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { PricingService } from './pricing.service';

const ruleFilter = z.object({
  jobType: z.nativeEnum(JobType).optional(),
  zoneId: z.string().uuid().optional(),
});

@ApiTags('pricing')
@ApiBearerAuth()
@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('estimates/ride')
  @RequireRole('CUSTOMER')
  @RateLimit({ name: 'estimate', limit: 60, windowSeconds: 300, keyBy: 'user' })
  ride(
    @CurrentUser() user: RequestUser,
    @ZodBody(rideEstimateSchema) input: RideEstimateInput,
    @AcceptLanguage() lang: 'ar' | 'en',
  ) {
    return this.pricing.estimateRide(user, input, lang);
  }

  @Post('estimates/delivery')
  @RequireRole('CUSTOMER')
  @RateLimit({ name: 'estimate', limit: 60, windowSeconds: 300, keyBy: 'user' })
  delivery(
    @CurrentUser() user: RequestUser,
    @ZodBody(deliveryEstimateSchema) input: DeliveryEstimateInput,
    @AcceptLanguage() lang: 'ar' | 'en',
  ) {
    return this.pricing.estimateDelivery(user, input, lang);
  }

  @Post('estimates/service')
  @RequireRole('CUSTOMER')
  @RateLimit({ name: 'estimate', limit: 60, windowSeconds: 300, keyBy: 'user' })
  service(
    @CurrentUser() user: RequestUser,
    @ZodBody(serviceEstimateSchema) input: ServiceEstimateInput,
    @AcceptLanguage() lang: 'ar' | 'en',
  ) {
    return this.pricing.estimateService(user, input, lang);
  }

  /* ---------------------------------------------------------------- admin */
  @Get('admin/pricing/rules')
  @RequirePermission(Permission.PRICING_READ)
  rules(@ZodQuery(ruleFilter) q: { jobType?: JobType; zoneId?: string }) {
    return this.pricing.listRules(q);
  }

  @Post('admin/pricing/rules')
  @RequirePermission(Permission.PRICING_MANAGE)
  createRule(
    @ZodBody(upsertPricingRuleSchema) input: UpsertPricingRuleInput,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.upsertRule(null, input, u.id, rid);
  }

  @Put('admin/pricing/rules/:id')
  @RequirePermission(Permission.PRICING_MANAGE)
  updateRule(
    @Param('id', UuidPipe) id: string,
    @ZodBody(upsertPricingRuleSchema) input: UpsertPricingRuleInput,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.upsertRule(id, input, u.id, rid);
  }

  @Get('admin/pricing/surge')
  @RequirePermission(Permission.PRICING_READ)
  surge(@ZodQuery(ruleFilter) q: { zoneId?: string }) {
    return this.pricing.listSurge(q.zoneId);
  }

  @Post('admin/pricing/surge')
  @RequirePermission(Permission.PRICING_MANAGE)
  createSurge(
    @ZodBody(surgeOverrideSchema) input: SurgeOverrideInput,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.createSurge(input, u.id, rid);
  }

  @Delete('admin/pricing/surge/:id')
  @RequirePermission(Permission.PRICING_MANAGE)
  endSurge(
    @Param('id', UuidPipe) id: string,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.endSurge(id, u.id, rid);
  }

  @Get('admin/pricing/cancellation-policies')
  @RequirePermission(Permission.PRICING_READ)
  cancellationPolicies() {
    return this.pricing.listCancellationPolicies();
  }

  @Post('admin/pricing/cancellation-policies')
  @RequirePermission(Permission.PRICING_MANAGE)
  createCancellation(
    @ZodBody(upsertCancellationPolicySchema) input: UpsertCancellationPolicyInput,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.upsertCancellationPolicy(null, input, u.id, rid);
  }

  @Put('admin/pricing/cancellation-policies/:id')
  @RequirePermission(Permission.PRICING_MANAGE)
  updateCancellation(
    @Param('id', UuidPipe) id: string,
    @ZodBody(upsertCancellationPolicySchema) input: UpsertCancellationPolicyInput,
    @CurrentUser() u: RequestUser,
    @RequestId() rid: string,
  ) {
    return this.pricing.upsertCancellationPolicy(id, input, u.id, rid);
  }
}
