import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DisputeStatus, Permission } from '@tamam/shared-types';
import {
  type DecideDisputeInput,
  type DisputeMessageInput,
  type OpenDisputeInput,
  decideDisputeSchema,
  disputeMessageSchema,
  openDisputeSchema,
  pageRequestSchema,
  uuidSchema,
} from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, Audited, CurrentUser, Idempotent, RateLimit, RequestId, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { DisputesService } from './disputes.service';

const disputeListSchema = pageRequestSchema.extend({
  status: z.nativeEnum(DisputeStatus).optional(),
  jobId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  partnerId: uuidSchema.optional(),
});
type DisputeListQuery = z.infer<typeof disputeListSchema>;

const addEvidenceSchema = z.object({ evidenceMediaIds: z.array(uuidSchema).min(1).max(10) });
type AddEvidenceBody = z.infer<typeof addEvidenceSchema>;

type PageQuery = z.infer<typeof pageRequestSchema>;

/**
 * Disputes (spec §64). Parties open and discuss them on the plain routes; staff review and settle
 * them under `/admin/disputes` — the decision is idempotent and audited as a sensitive action.
 */
@ApiTags('disputes')
@ApiBearerAuth()
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  /* ------------------------------------------------------------ party side */

  @Post('disputes')
  @RateLimit({ name: 'disputes.open', limit: 5, windowSeconds: 3600, keyBy: 'user' })
  open(@CurrentUser() user: RequestUser, @ZodBody(openDisputeSchema) input: OpenDisputeInput) {
    return this.disputes.open(user, input);
  }

  @Get('disputes')
  @AllowRestricted()
  listMine(@CurrentUser() user: RequestUser, @ZodQuery(pageRequestSchema) query: PageQuery) {
    return this.disputes.listMine(user, query.cursor, query.limit);
  }

  @Get('disputes/:id')
  @AllowRestricted()
  getMine(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.disputes.getMine(user, id);
  }

  @Post('disputes/:id/messages')
  addMessage(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(disputeMessageSchema) input: DisputeMessageInput) {
    return this.disputes.addMessage(user, id, input);
  }

  @Post('disputes/:id/evidence')
  addEvidence(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(addEvidenceSchema) body: AddEvidenceBody) {
    return this.disputes.addEvidence(user, id, body.evidenceMediaIds);
  }

  /* ----------------------------------------------------------------- admin */

  @Get('admin/disputes')
  @RequirePermission(Permission.DISPUTES_READ)
  list(@ZodQuery(disputeListSchema) query: DisputeListQuery) {
    return this.disputes.list(query);
  }

  @Get('admin/disputes/:id')
  @RequirePermission(Permission.DISPUTES_READ)
  get(@Param('id', UuidPipe) id: string) {
    return this.disputes.get(id);
  }

  @Post('admin/disputes/:id/messages')
  @RequirePermission(Permission.DISPUTES_READ)
  agentMessage(@CurrentUser() actor: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(disputeMessageSchema) input: DisputeMessageInput) {
    return this.disputes.addMessage(actor, id, input);
  }

  @Post('admin/disputes/:id/decision')
  @RequirePermission(Permission.DISPUTES_DECIDE)
  @Idempotent('disputes.decide')
  @Audited({ action: 'dispute.decide', entity: 'dispute', entityIdFrom: 'id', sensitive: true })
  decide(
    @Param('id', UuidPipe) id: string,
    @ZodBody(decideDisputeSchema) input: DecideDisputeInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.disputes.decide(id, input, actor, requestId);
  }
}
