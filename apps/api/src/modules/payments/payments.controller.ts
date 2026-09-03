import { Controller, Get, HttpCode, Param, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, PaymentMethod, PaymentStatus, RefundStatus } from '@tamam/shared-types';
import { type IssueRefundInput, issueRefundSchema, pageRequestSchema } from '@tamam/validation';
import type { Request } from 'express';
import { z } from 'zod';

import { Audited, CurrentUser, Idempotent, Public, RateLimit, RequestId, RequirePermission, ZodBody, ZodParams, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { PaymentsService } from './payments.service';

const paymentListSchema = pageRequestSchema.extend({
  jobId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
type PaymentListQuery = z.infer<typeof paymentListSchema>;

const refundListSchema = pageRequestSchema.extend({
  paymentId: z.string().uuid().optional(),
  disputeId: z.string().uuid().optional(),
  status: z.nativeEnum(RefundStatus).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
type RefundListQuery = z.infer<typeof refundListSchema>;

const webhookParamsSchema = z.object({ provider: z.string().trim().min(2).max(40) });
type WebhookParams = z.infer<typeof webhookParamsSchema>;

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('jobs/:id/payment')
  getForJob(@Param('id', UuidPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.payments.getForJob(id, user);
  }

  /**
   * Provider callback. Public because the signature in the raw body is the authentication —
   * `main.ts` enables `rawBody` so the exact bytes reach the provider adapter.
   */
  @Post('payments/webhooks/:provider')
  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'payments.webhook', limit: 600, windowSeconds: 60, keyBy: 'ip' })
  webhook(@ZodParams(webhookParamsSchema) params: WebhookParams, @Req() req: RawBodyRequest<Request>) {
    return this.payments.handleWebhook(params.provider, req.rawBody, req.headers);
  }

  /* ---------------------------------------------------------------- admin */

  @Get('admin/payments')
  @RequirePermission(Permission.PAYMENTS_READ)
  adminList(@ZodQuery(paymentListSchema) query: PaymentListQuery) {
    return this.payments.adminList(query);
  }

  @Get('admin/payments/:id')
  @RequirePermission(Permission.PAYMENTS_READ)
  adminGet(@Param('id', UuidPipe) id: string) {
    return this.payments.adminGet(id);
  }

  @Post('admin/refunds')
  @RequirePermission(Permission.REFUNDS_ISSUE)
  @Idempotent('refunds.issue')
  @Audited({ action: 'refund.issue', entity: 'refund', entityIdFrom: 'paymentId', sensitive: true })
  issueRefund(@ZodBody(issueRefundSchema) input: IssueRefundInput, @CurrentUser() actor: RequestUser, @RequestId() requestId: string) {
    return this.payments.refund(input, actor, requestId);
  }

  @Get('admin/refunds')
  @RequirePermission(Permission.PAYMENTS_READ)
  listRefunds(@ZodQuery(refundListSchema) query: RefundListQuery) {
    return this.payments.listRefunds(query);
  }
}
