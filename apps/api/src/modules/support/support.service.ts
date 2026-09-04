import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ErrorCode,
  MediaPurpose,
  NotificationEvent,
  type Page,
  Permission,
  type SupportTicketDto,
  type TicketCategory,
  type TicketPriority,
  TicketStatus,
  UserRole,
} from '@tamam/shared-types';
import type { CreateTicketInput, ReportInput, TicketMessageInput, UpdateTicketInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type JobLike, JobPolicy } from '../jobs/domain/job-policy';
import { MediaUrlService } from '../media/media-url.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

import { ACTIVE_TICKET_STATUSES, assertTicketTransition, priorityFor, routeReport, ticketNumber } from './domain/ticket-state';

/* ------------------------------------------------------------- contracts */

export interface SupportMessageDto {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string | null;
  /** `USER` = the person who raised the ticket, `AGENT` = anyone answering it. */
  authorRole: 'USER' | 'AGENT';
  text: string;
  internal: boolean;
  attachmentUrls: string[];
  createdAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketDto {
  messages: SupportMessageDto[];
}

export interface UserReportDto {
  id: string;
  jobId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description: string | null;
  status: string;
  ticketId: string | null;
  createdAt: string;
}

export interface ReportResultDto {
  report: UserReportDto;
  ticket: SupportTicketDto;
}

export interface TicketListFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedAgentId?: string;
  /** Free text over the ticket number and subject. */
  q?: string;
  cursor?: string;
  limit: number;
}

export interface ReportListFilter {
  status?: string;
  reportedId?: string;
  reporterId?: string;
  jobId?: string;
  cursor?: string;
  limit: number;
}

const messageInclude = { author: { select: { fullName: true } }, attachments: { include: { media: true } } } satisfies Prisma.SupportMessageInclude;

const ticketInclude = { attachments: { include: { media: true } } } satisfies Prisma.SupportTicketInclude;

const ticketDetailInclude = {
  attachments: { include: { media: true } },
  messages: { orderBy: { createdAt: 'asc' as const }, include: messageInclude },
} satisfies Prisma.SupportTicketInclude;

type TicketRow = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;
type TicketDetailRow = Prisma.SupportTicketGetPayload<{ include: typeof ticketDetailInclude }>;
type MessageRow = Prisma.SupportMessageGetPayload<{ include: typeof messageInclude }>;

const TICKET_COUNTER = 'ticket_number';

/**
 * Support tickets, in-ticket conversations and user reports (spec §63). Users see their own
 * tickets without internal notes; agents see everything, and every agent-side mutation is audited.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------------ user side */

  async createTicket(user: RequestUser, input: CreateTicketInput): Promise<SupportTicketDto> {
    await this.media.assertOwnedReady(user.id, input.attachmentMediaIds, [MediaPurpose.SUPPORT]);

    let job: JobLike | null = null;
    if (input.jobId) {
      job = await this.loadJob(input.jobId);
      if (!JobPolicy.canView(user, job)) throw AppException.forbidden('You cannot open a ticket about this job');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          number: ticketNumber(await this.prisma.nextCounter(TICKET_COUNTER, tx), new Date()),
          category: input.category,
          priority: priorityFor(input.category),
          subject: input.subject,
          description: input.description,
          raisedById: user.id,
          raisedByRole: this.raisedByRoleFor(user, job),
          jobId: job?.id ?? null,
        },
        select: { id: true },
      });
      await this.attachMedia(tx, created.id, null, input.attachmentMediaIds);
      return tx.supportTicket.findUniqueOrThrow({ where: { id: created.id }, include: ticketInclude });
    });

    return this.toDto(ticket);
  }

  async listMine(user: RequestUser, cursorRaw: string | undefined, limit: number): Promise<Page<SupportTicketDto>> {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.supportTicket.findMany({
      where: { raisedById: user.id, ...cursorWhere(cursor) },
      include: ticketInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (row) => this.toDto(row));
  }

  /** The raiser's view: internal agent notes are stripped before the ticket leaves the service. */
  async getMine(user: RequestUser, id: string): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketDetailInclude });
    if (!ticket || ticket.raisedById !== user.id) throw AppException.notFound('Support ticket', id);
    return this.toDetailDto(ticket, { includeInternal: false });
  }

  /* -------------------------------------------------------------- messages */

  /**
   * Adds one message to a ticket. A user reply reopens a resolved ticket; an agent reply records
   * the first response time, moves the ticket to WAITING_USER and notifies the raiser.
   */
  async addMessage(user: RequestUser, ticketId: string, input: TicketMessageInput): Promise<SupportMessageDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, status: true, raisedById: true, assignedAgentId: true, firstResponseAt: true },
    });
    if (!ticket) throw AppException.notFound('Support ticket', ticketId);

    const isAgent = this.isAgent(user);
    const isOwner = ticket.raisedById === user.id;
    if (!isAgent && !isOwner) throw AppException.notFound('Support ticket', ticketId);
    if (ticket.status === TicketStatus.CLOSED) throw AppException.conflict('This ticket is closed', ErrorCode.CONFLICT);

    // Only agents may write internal notes; a user-supplied flag is ignored, never honoured.
    const internal = isAgent && input.internal;
    await this.media.assertOwnedReady(user.id, input.attachmentMediaIds, [MediaPurpose.SUPPORT]);

    const nextStatus = this.statusAfterMessage(ticket.status, isAgent, internal);
    if (nextStatus) assertTicketTransition(ticket.status, nextStatus);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, text: input.text, isInternal: internal },
        select: { id: true },
      });
      await this.attachMedia(tx, ticket.id, created.id, input.attachmentMediaIds);

      const firstResponse = isAgent && !internal && !ticket.firstResponseAt;
      if (nextStatus || firstResponse) {
        const data: Prisma.SupportTicketUncheckedUpdateInput = nextStatus ? this.statusPatch(nextStatus) : {};
        if (firstResponse) data.firstResponseAt = new Date();
        await tx.supportTicket.update({ where: { id: ticket.id }, data });
      }

      return tx.supportMessage.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude });
    });

    await this.notifyMessage(ticket, user, isAgent, internal);
    return this.toMessageDto(message, ticket.raisedById);
  }

  private statusAfterMessage(current: TicketStatus, isAgent: boolean, internal: boolean): TicketStatus | null {
    if (isAgent) {
      if (internal) return current === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : null;
      return current === TicketStatus.WAITING_USER ? null : TicketStatus.WAITING_USER;
    }
    // The user answered: a resolved or waiting ticket goes back into the agent queue.
    return current === TicketStatus.RESOLVED || current === TicketStatus.WAITING_USER ? TicketStatus.IN_PROGRESS : null;
  }

  private async notifyMessage(
    ticket: { id: string; number: string; raisedById: string; assignedAgentId: string | null },
    author: RequestUser,
    isAgent: boolean,
    internal: boolean,
  ): Promise<void> {
    if (internal) return;
    const recipient = isAgent ? ticket.raisedById : ticket.assignedAgentId;
    if (!recipient || recipient === author.id) return;
    await this.notifications.notify({
      userId: recipient,
      event: NotificationEvent.SUPPORT_REPLY,
      vars: { ticketNumber: ticket.number },
      data: { ticketId: ticket.id },
      collapseKey: `support:${ticket.id}`,
    });
  }

  /* --------------------------------------------------------------- reports */

  /**
   * Reports the other party of a job. Always produces a ticket so the report lands in the same
   * agent queue; unsafe driving and harassment escalate to a CRITICAL safety ticket.
   */
  async report(user: RequestUser, input: ReportInput): Promise<ReportResultDto> {
    const job = await this.loadJob(input.jobId);
    if (!JobPolicy.canView(user, job)) throw AppException.notFound('Job', input.jobId); // 404, not 403: don't leak existence (spec §88)

    const isCustomer = JobPolicy.isCustomer(user, job);
    const isPartner = JobPolicy.isAssignedPartner(user, job);
    if (!isCustomer && !isPartner) throw AppException.forbidden('Only the parties of a job can report each other');

    const reportedId = isCustomer ? job.partnerId : job.customerId;
    if (!reportedId) throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'This job has no other party to report');

    await this.media.assertOwnedReady(user.id, input.attachmentMediaIds, [MediaPurpose.SUPPORT]);
    const routing = routeReport(input.reason, isCustomer);
    // Machine-readable subject/description: apps render the `reason` key, agents read the detail.
    const description = input.description?.trim().length ? input.description.trim() : `REPORT:${input.reason} job=${job.id}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          number: ticketNumber(await this.prisma.nextCounter(TICKET_COUNTER, tx), new Date()),
          category: routing.category,
          priority: routing.priority,
          subject: `REPORT:${input.reason}`.slice(0, 120),
          description: description.slice(0, 3000),
          raisedById: user.id,
          raisedByRole: isCustomer ? UserRole.CUSTOMER : UserRole.PARTNER,
          jobId: job.id,
        },
        select: { id: true },
      });
      await this.attachMedia(tx, ticket.id, null, input.attachmentMediaIds);
      const report = await tx.userReport.create({
        data: {
          jobId: job.id,
          reporterId: user.id,
          reportedId,
          reason: input.reason,
          description: input.description?.trim() ?? null,
          ticketId: ticket.id,
        },
      });
      const stored = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: ticketInclude });
      return { report, ticket: stored };
    });

    return { report: this.toReportDto(result.report), ticket: this.toDto(result.ticket) };
  }

  /* ----------------------------------------------------------------- admin */

  async list(filter: TicketListFilter): Promise<Page<SupportTicketDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.supportTicket.findMany({
      where: {
        ...cursorWhere(cursor),
        status: filter.status,
        priority: filter.priority,
        category: filter.category,
        assignedAgentId: filter.assignedAgentId,
        ...(filter.q
          ? { OR: [{ number: { contains: filter.q, mode: 'insensitive' } }, { subject: { contains: filter.q, mode: 'insensitive' } }] }
          : {}),
      },
      include: ticketInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toDto(row));
  }

  /** Agent view: internal notes included. */
  async get(id: string): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketDetailInclude });
    if (!ticket) throw AppException.notFound('Support ticket', id);
    return this.toDetailDto(ticket, { includeInternal: true });
  }

  async update(id: string, input: UpdateTicketInput, actor: RequestUser, requestId: string | null = null): Promise<SupportTicketDto> {
    const before = await this.prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
    if (!before) throw AppException.notFound('Support ticket', id);
    if (input.status) assertTicketTransition(before.status, input.status);
    if (input.assignedAgentId) await this.assertAgentExists(input.assignedAgentId);

    const data: Prisma.SupportTicketUncheckedUpdateInput = input.status ? this.statusPatch(input.status) : {};
    if (input.priority) data.priority = input.priority;
    if (input.category) data.category = input.category;
    if (input.assignedAgentId !== undefined) data.assignedAgentId = input.assignedAgentId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supportTicket.update({ where: { id }, data, include: ticketInclude });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'support_ticket.update',
          entity: 'support_ticket',
          entityId: id,
          oldValue: { status: before.status, priority: before.priority, category: before.category, assignedAgentId: before.assignedAgentId },
          newValue: { status: row.status, priority: row.priority, category: row.category, assignedAgentId: row.assignedAgentId },
          requestId,
        },
        tx,
      );
      return row;
    });

    return this.toDto(updated);
  }

  /** Assignment is an ordinary update so it lands in the same audit trail. */
  async assign(id: string, agentId: string, actor: RequestUser, requestId: string | null = null): Promise<SupportTicketDto> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { status: true } });
    if (!ticket) throw AppException.notFound('Support ticket', id);
    const status = ticket.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : undefined;
    return this.update(id, { assignedAgentId: agentId, ...(status ? { status } : {}) }, actor, requestId);
  }

  async listReports(filter: ReportListFilter): Promise<Page<UserReportDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.userReport.findMany({
      where: { ...cursorWhere(cursor), status: filter.status, reportedId: filter.reportedId, reporterId: filter.reporterId, jobId: filter.jobId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toReportDto(row));
  }

  /** Tickets still waiting on somebody — the ops dashboard counter. */
  async openTicketCount(): Promise<number> {
    return this.prisma.supportTicket.count({ where: { status: { in: [...ACTIVE_TICKET_STATUSES] } } });
  }

  /* ---------------------------------------------------------------- helpers */

  private async loadJob(jobId: string): Promise<JobLike> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, partnerId: true, status: true, zoneId: true },
    });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  private isAgent(user: RequestUser): boolean {
    return user.isSuperAdmin || user.permissions.includes(Permission.SUPPORT_MANAGE);
  }

  private async assertAgentExists(agentId: string): Promise<void> {
    const agent = await this.prisma.user.findUnique({ where: { id: agentId }, select: { id: true, accountStatus: true } });
    if (!agent || agent.accountStatus === 'DELETED') throw AppException.notFound('Agent', agentId);
  }

  private raisedByRoleFor(user: RequestUser, job: JobLike | null): string {
    if (job) {
      if (JobPolicy.isAssignedPartner(user, job)) return UserRole.PARTNER;
      if (JobPolicy.isCustomer(user, job)) return UserRole.CUSTOMER;
    }
    return user.roles.includes(UserRole.PARTNER) && !user.roles.includes(UserRole.CUSTOMER) ? UserRole.PARTNER : UserRole.CUSTOMER;
  }

  private statusPatch(status: TicketStatus): Prisma.SupportTicketUncheckedUpdateInput {
    const patch: Prisma.SupportTicketUncheckedUpdateInput = { status };
    if (status === TicketStatus.RESOLVED) patch.resolvedAt = new Date();
    if (status === TicketStatus.CLOSED) patch.closedAt = new Date();
    return patch;
  }

  private async attachMedia(tx: Tx, ticketId: string, messageId: string | null, mediaIds: string[]): Promise<void> {
    if (!mediaIds.length) return;
    await tx.supportAttachment.createMany({ data: mediaIds.map((mediaId) => ({ ticketId, messageId, mediaId })) });
  }

  /* ---------------------------------------------------------------- mapping */

  private toDto(ticket: TicketRow): SupportTicketDto {
    const isPartner = ticket.raisedByRole === UserRole.PARTNER;
    return {
      id: ticket.id,
      number: ticket.number,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      description: ticket.description,
      customerId: isPartner ? null : ticket.raisedById,
      partnerId: isPartner ? ticket.raisedById : null,
      jobId: ticket.jobId,
      assignedAgentId: ticket.assignedAgentId,
      // Ticket-level attachments only; the ones bound to a message travel with that message.
      attachmentUrls: ticket.attachments.filter((a) => a.messageId === null).map((a) => this.mediaUrls.urlFor(a.media, 'medium')),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private toDetailDto(ticket: TicketDetailRow, opts: { includeInternal: boolean }): SupportTicketDetailDto {
    const messages = opts.includeInternal ? ticket.messages : ticket.messages.filter((m) => !m.isInternal);
    return {
      ...this.toDto(ticket),
      messages: messages.map((m) => this.toMessageDto(m, ticket.raisedById)),
    };
  }

  private toMessageDto(message: MessageRow, raisedById: string): SupportMessageDto {
    return {
      id: message.id,
      ticketId: message.ticketId,
      authorId: message.authorId,
      authorName: message.author.fullName,
      authorRole: message.authorId === raisedById ? 'USER' : 'AGENT',
      text: message.text,
      internal: message.isInternal,
      attachmentUrls: message.attachments.map((a) => this.mediaUrls.urlFor(a.media, 'medium')),
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toReportDto(report: {
    id: string;
    jobId: string;
    reporterId: string;
    reportedId: string;
    reason: string;
    description: string | null;
    status: string;
    ticketId: string | null;
    createdAt: Date;
  }): UserReportDto {
    return {
      id: report.id,
      jobId: report.jobId,
      reporterId: report.reporterId,
      reportedId: report.reportedId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      ticketId: report.ticketId,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
