import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, TicketCategory, TicketPriority, TicketStatus } from '@tamam/shared-types';
import {
  type CreateTicketInput,
  type ReportInput,
  type TicketMessageInput,
  type UpdateTicketInput,
  createTicketSchema,
  pageRequestSchema,
  reportSchema,
  ticketMessageSchema,
  updateTicketSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  Audited,
  CurrentUser,
  RateLimit,
  RequestId,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { SupportService } from './support.service';

const ticketListSchema = pageRequestSchema.extend({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedAgentId: z.string().uuid().optional(),
  q: z.string().trim().max(60).optional(),
});
type TicketListQuery = z.infer<typeof ticketListSchema>;

const reportListSchema = pageRequestSchema.extend({
  status: z.string().trim().max(20).optional(),
  reportedId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
});
type ReportListQuery = z.infer<typeof reportListSchema>;

type PageQuery = z.infer<typeof pageRequestSchema>;

/**
 * Support desk (spec §63). The `/support/*` routes belong to the person who raised the ticket;
 * the `/admin/support/*` routes are permission-gated and audited.
 */
@ApiTags('support')
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /* ------------------------------------------------------------ user side */

  @Post('support/tickets')
  @AllowRestricted()
  @RateLimit({ name: 'support.ticket', limit: 10, windowSeconds: 3600, keyBy: 'user' })
  createTicket(
    @CurrentUser() user: RequestUser,
    @ZodBody(createTicketSchema) input: CreateTicketInput,
  ) {
    return this.support.createTicket(user, input);
  }

  @Get('support/tickets')
  @AllowRestricted()
  listMine(@CurrentUser() user: RequestUser, @ZodQuery(pageRequestSchema) query: PageQuery) {
    return this.support.listMine(user, query.cursor, query.limit);
  }

  @Get('support/tickets/:id')
  @AllowRestricted()
  getMine(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.support.getMine(user, id);
  }

  @Post('support/tickets/:id/messages')
  @AllowRestricted()
  @RateLimit({ name: 'support.message', limit: 60, windowSeconds: 3600, keyBy: 'user' })
  addMessage(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) id: string,
    @ZodBody(ticketMessageSchema) input: TicketMessageInput,
  ) {
    return this.support.addMessage(user, id, input);
  }

  @Post('support/reports')
  @AllowRestricted()
  @RateLimit({ name: 'support.report', limit: 10, windowSeconds: 3600, keyBy: 'user' })
  report(@CurrentUser() user: RequestUser, @ZodBody(reportSchema) input: ReportInput) {
    return this.support.report(user, input);
  }

  /* ----------------------------------------------------------------- admin */

  @Get('admin/support/tickets')
  @RequirePermission(Permission.SUPPORT_READ)
  list(@ZodQuery(ticketListSchema) query: TicketListQuery) {
    return this.support.list(query);
  }

  @Get('admin/support/tickets/:id')
  @RequirePermission(Permission.SUPPORT_READ)
  get(@Param('id', UuidPipe) id: string) {
    return this.support.get(id);
  }

  @Patch('admin/support/tickets/:id')
  @RequirePermission(Permission.SUPPORT_MANAGE)
  @Audited({ action: 'support_ticket.update', entity: 'support_ticket', entityIdFrom: 'id' })
  update(
    @Param('id', UuidPipe) id: string,
    @ZodBody(updateTicketSchema) input: UpdateTicketInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.support.update(id, input, actor, requestId);
  }

  @Post('admin/support/tickets/:id/messages')
  @RequirePermission(Permission.SUPPORT_MANAGE)
  agentMessage(
    @Param('id', UuidPipe) id: string,
    @CurrentUser() actor: RequestUser,
    @ZodBody(ticketMessageSchema) input: TicketMessageInput,
  ) {
    return this.support.addMessage(actor, id, input);
  }

  @Get('admin/support/reports')
  @RequirePermission(Permission.SUPPORT_READ)
  listReports(@ZodQuery(reportListSchema) query: ReportListQuery) {
    return this.support.listReports(query);
  }
}
