import {
  AccountStatus,
  ErrorCode,
  JobStatus,
  NotificationEvent,
  Permission,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { MediaUrlService } from '../media/media-url.service';
import type { MediaService } from '../media/media.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { canTransitionTicket, priorityFor, routeReport, ticketNumber } from './domain/ticket-state';
import { SupportService } from './support.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const AGENT_ID = '44444444-4444-4444-8444-444444444444';
const ZONE_ID = '55555555-5555-4555-8555-555555555555';
const TICKET_ID = '66666666-6666-4666-8666-666666666666';

interface TicketState {
  id: string;
  number: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  raisedById: string;
  raisedByRole: string;
  jobId: string | null;
  assignedAgentId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: Array<{ messageId: string | null; media: { bucket: string; objectKey: string; isPublic: boolean; mediumKey: string | null; thumbnailKey: string | null } }>;
  messages: Array<{
    id: string;
    ticketId: string;
    authorId: string;
    text: string;
    isInternal: boolean;
    createdAt: Date;
    author: { fullName: string | null };
    attachments: Array<{ media: { bucket: string; objectKey: string; isPublic: boolean; mediumKey: string | null; thumbnailKey: string | null } }>;
  }>;
}

function ticketState(overrides: Partial<TicketState> = {}): TicketState {
  return {
    id: TICKET_ID,
    number: 'TK-2604-000001',
    category: TicketCategory.JOB_ISSUE,
    priority: TicketPriority.NORMAL,
    status: TicketStatus.OPEN,
    subject: 'Driver took a longer route',
    description: 'The trip cost more than the estimate.',
    raisedById: CUSTOMER_ID,
    raisedByRole: UserRole.CUSTOMER,
    jobId: JOB_ID,
    assignedAgentId: null,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date('2026-04-01T08:00:00.000Z'),
    updatedAt: new Date('2026-04-01T08:00:00.000Z'),
    attachments: [],
    messages: [],
    ...overrides,
  };
}

function principal(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: CUSTOMER_ID,
    phone: '+970599000001',
    roles: [UserRole.CUSTOMER],
    permissions: [],
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    language: 'ar',
    customerId: CUSTOMER_ID,
    isSuperAdmin: false,
    ...overrides,
  };
}

const agent = (): RequestUser =>
  principal({ id: AGENT_ID, customerId: undefined, roles: [UserRole.SUPPORT], permissions: [Permission.SUPPORT_READ, Permission.SUPPORT_MANAGE] });

function buildHarness(options: { ticket?: TicketState } = {}) {
  const ticket = options.ticket ?? ticketState();
  const reports: Array<Record<string, unknown>> = [];
  const createdTickets: Array<Record<string, unknown>> = [];
  const attachments: Array<Record<string, unknown>> = [];

  const job = { id: JOB_ID, customerId: CUSTOMER_ID, partnerId: PARTNER_ID, status: JobStatus.COMPLETED, zoneId: ZONE_ID };

  const supportTicketCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    createdTickets.push(data);
    Object.assign(ticket, {
      number: String(data.number),
      category: data.category as TicketCategory,
      priority: data.priority as TicketPriority,
      subject: String(data.subject),
      raisedByRole: String(data.raisedByRole),
    });
    return { id: ticket.id };
  });

  const supportTicketUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(ticket, data);
    return ticket;
  });

  const supportMessageCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row = {
      id: `sm-${ticket.messages.length + 1}`,
      ticketId: String(data.ticketId),
      authorId: String(data.authorId),
      text: String(data.text),
      isInternal: Boolean(data.isInternal),
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      author: { fullName: 'Support Agent' },
      attachments: [],
    };
    ticket.messages.push(row);
    return { id: row.id };
  });

  const prisma = {
    job: { findUnique: jest.fn(async () => job) },
    supportTicket: {
      create: supportTicketCreate,
      update: supportTicketUpdate,
      findUnique: jest.fn(async () => ticket),
      findUniqueOrThrow: jest.fn(async () => ticket),
      findMany: jest.fn(async () => [ticket]),
      count: jest.fn(async () => 3),
    },
    supportMessage: {
      create: supportMessageCreate,
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => ticket.messages.find((m) => m.id === where.id)),
    },
    supportAttachment: {
      createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        attachments.push(...data);
        return { count: data.length };
      }),
    },
    userReport: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ur-${reports.length + 1}`, status: 'OPEN', createdAt: new Date('2026-04-01T09:00:00.000Z'), ...data };
        reports.push(row);
        return row;
      }),
      findMany: jest.fn(async () => reports),
    },
    user: { findUnique: jest.fn(async () => ({ id: AGENT_ID, accountStatus: AccountStatus.ACTIVE })) },
    nextCounter: jest.fn(async () => 1n),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const assertOwnedReady = jest.fn(async () => undefined);
  const media = { assertOwnedReady } as unknown as MediaService;
  const mediaUrls = { urlFor: jest.fn(() => '/api/v1/media/key/view') } as unknown as MediaUrlService;
  const notify = jest.fn(async () => undefined);
  const notifications = { notify } as unknown as NotificationsService;
  const record = jest.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;

  const service = new SupportService(prisma, media, mediaUrls, notifications, audit);
  return { service, ticket, reports, createdTickets, attachments, mocks: { supportTicketCreate, supportTicketUpdate, supportMessageCreate, notify, record, assertOwnedReady } };
}

describe('support domain rules', () => {
  it('formats ticket numbers as TK-YYMM-NNNNNN', () => {
    expect(ticketNumber(42n, new Date('2026-04-15T00:00:00.000Z'))).toBe('TK-2604-000042');
  });

  it('escalates safety tickets by default', () => {
    expect(priorityFor(TicketCategory.SAFETY)).toBe(TicketPriority.HIGH);
    expect(priorityFor(TicketCategory.PAYMENT)).toBe(TicketPriority.NORMAL);
    expect(priorityFor(TicketCategory.SAFETY, TicketPriority.LOW)).toBe(TicketPriority.LOW);
  });

  it('routes unsafe driving and harassment to a CRITICAL safety ticket', () => {
    expect(routeReport('UNSAFE_DRIVING', true)).toEqual({ category: TicketCategory.SAFETY, priority: TicketPriority.CRITICAL });
    expect(routeReport('HARASSMENT', false)).toEqual({ category: TicketCategory.SAFETY, priority: TicketPriority.CRITICAL });
    expect(routeReport('OVERCHARGE', true)).toEqual({ category: TicketCategory.PARTNER_BEHAVIOUR, priority: TicketPriority.HIGH });
    expect(routeReport('NO_SHOW', false)).toEqual({ category: TicketCategory.CUSTOMER_BEHAVIOUR, priority: TicketPriority.HIGH });
  });

  it('never lets a closed ticket move again', () => {
    expect(canTransitionTicket(TicketStatus.OPEN, TicketStatus.IN_PROGRESS)).toBe(true);
    expect(canTransitionTicket(TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS)).toBe(true);
    expect(canTransitionTicket(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(false);
    expect(canTransitionTicket(TicketStatus.IN_PROGRESS, TicketStatus.OPEN)).toBe(false);
  });
});

describe('SupportService.createTicket', () => {
  it('numbers the ticket, validates attachments and stores the raiser role', async () => {
    const { service, createdTickets, mocks } = buildHarness();
    const mediaId = '77777777-7777-4777-8777-777777777777';

    const dto = await service.createTicket(principal(), {
      category: TicketCategory.PAYMENT,
      subject: 'Charged twice',
      description: 'My card was charged twice for the same trip.',
      jobId: JOB_ID,
      attachmentMediaIds: [mediaId],
    });

    expect(dto.number).toMatch(/^TK-\d{4}-000001$/);
    expect(mocks.assertOwnedReady).toHaveBeenCalledWith(CUSTOMER_ID, [mediaId], ['SUPPORT']);
    expect(createdTickets[0]).toMatchObject({ raisedByRole: UserRole.CUSTOMER, priority: TicketPriority.NORMAL });
    expect(dto.customerId).toBe(CUSTOMER_ID);
    expect(dto.partnerId).toBeNull();
  });

  it('refuses a ticket about a job the user cannot view', async () => {
    const { service } = buildHarness();
    const outsider = principal({ id: AGENT_ID, customerId: AGENT_ID, roles: [UserRole.CUSTOMER], permissions: [] });

    await expect(
      service.createTicket(outsider, {
        category: TicketCategory.JOB_ISSUE,
        subject: 'Not my job',
        description: 'I would like details about this job please.',
        jobId: JOB_ID,
        attachmentMediaIds: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

describe('SupportService.addMessage', () => {
  it('records the first response and puts an agent reply into WAITING_USER', async () => {
    const { service, ticket, mocks } = buildHarness();

    await service.addMessage(agent(), TICKET_ID, { text: 'We are looking into it.', attachmentMediaIds: [], internal: false });

    expect(ticket.status).toBe(TicketStatus.WAITING_USER);
    expect(ticket.firstResponseAt).toBeInstanceOf(Date);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: CUSTOMER_ID, event: NotificationEvent.SUPPORT_REPLY, vars: { ticketNumber: 'TK-2604-000001' } }),
    );
  });

  it('keeps an internal note invisible and does not notify the user', async () => {
    const { service, ticket, mocks } = buildHarness();

    const message = await service.addMessage(agent(), TICKET_ID, { text: 'Refund pre-approved by finance.', attachmentMediaIds: [], internal: true });

    expect(message.internal).toBe(true);
    expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
    expect(ticket.firstResponseAt).toBeNull();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('ignores the internal flag when the user sets it', async () => {
    const { service } = buildHarness();

    const message = await service.addMessage(principal(), TICKET_ID, { text: 'Any news?', attachmentMediaIds: [], internal: true });

    expect(message.internal).toBe(false);
    expect(message.authorRole).toBe('USER');
  });

  it('reopens a resolved ticket when the user replies', async () => {
    const { service, ticket } = buildHarness({ ticket: ticketState({ status: TicketStatus.RESOLVED, resolvedAt: new Date() }) });

    await service.addMessage(principal(), TICKET_ID, { text: 'This is still happening.', attachmentMediaIds: [], internal: false });

    expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('refuses to write into a closed ticket', async () => {
    const { service } = buildHarness({ ticket: ticketState({ status: TicketStatus.CLOSED, closedAt: new Date() }) });

    await expect(service.addMessage(principal(), TICKET_ID, { text: 'Hello?', attachmentMediaIds: [], internal: false })).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it('hides someone else’s ticket behind a 404', async () => {
    const { service } = buildHarness();
    const stranger = principal({ id: PARTNER_ID, customerId: PARTNER_ID });

    await expect(service.addMessage(stranger, TICKET_ID, { text: 'Hi', attachmentMediaIds: [], internal: false })).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});

describe('SupportService.report', () => {
  it('creates a CRITICAL safety ticket and links the report to it', async () => {
    const { service, reports, createdTickets } = buildHarness();

    const result = await service.report(principal(), {
      jobId: JOB_ID,
      reason: 'UNSAFE_DRIVING',
      description: 'The driver ran two red lights.',
      attachmentMediaIds: [],
    });

    expect(createdTickets[0]).toMatchObject({ category: TicketCategory.SAFETY, priority: TicketPriority.CRITICAL, subject: 'REPORT:UNSAFE_DRIVING' });
    expect(result.report.reportedId).toBe(PARTNER_ID);
    expect(result.report.ticketId).toBe(TICKET_ID);
    expect(reports).toHaveLength(1);
  });

  it('reports the customer when the partner is the reporter', async () => {
    const { service, createdTickets } = buildHarness();
    const reportingPartner = principal({ id: PARTNER_ID, customerId: undefined, partnerId: PARTNER_ID, roles: [UserRole.PARTNER] });

    const result = await service.report(reportingPartner, { jobId: JOB_ID, reason: 'NO_SHOW', attachmentMediaIds: [] });

    expect(result.report.reportedId).toBe(CUSTOMER_ID);
    expect(createdTickets[0]).toMatchObject({ category: TicketCategory.CUSTOMER_BEHAVIOUR, raisedByRole: UserRole.PARTNER });
  });
});

describe('SupportService.update', () => {
  it('stamps resolvedAt and writes an audit entry', async () => {
    const { service, ticket, mocks } = buildHarness({ ticket: ticketState({ status: TicketStatus.IN_PROGRESS }) });

    await service.update(TICKET_ID, { status: TicketStatus.RESOLVED }, agent(), 'req-1');

    expect(ticket.status).toBe(TicketStatus.RESOLVED);
    expect(ticket.resolvedAt).toBeInstanceOf(Date);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support_ticket.update', entity: 'support_ticket', entityId: TICKET_ID }),
      expect.anything(),
    );
  });

  it('rejects an impossible transition', async () => {
    const { service } = buildHarness({ ticket: ticketState({ status: TicketStatus.CLOSED, closedAt: new Date() }) });

    await expect(service.update(TICKET_ID, { status: TicketStatus.OPEN }, agent(), 'req-2')).rejects.toMatchObject({
      code: ErrorCode.INVALID_STATE_TRANSITION,
    });
  });
});

describe('SupportService.openTicketCount', () => {
  it('counts only tickets that still need somebody', async () => {
    const { service } = buildHarness();
    await expect(service.openTicketCount()).resolves.toBe(3);
  });
});
