import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DisputeStatus,
  ErrorCode,
  JobActorType,
  JobStatus,
  LedgerTransactionType,
  MediaPurpose,
  type Money,
  NotificationEvent,
  type Page,
  PaymentStatus,
  Permission,
  UserRole,
  WalletOwnerType,
} from '@tamam/shared-types';
import type { DecideDisputeInput, DisputeMessageInput, OpenDisputeInput } from '@tamam/validation';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { toMoney } from '../../common/utils/money';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type JobLike, JobPolicy } from '../jobs/domain/job-policy';
import { JobsService } from '../jobs/jobs.service';
import { LedgerService } from '../ledger/ledger.service';
import { MediaUrlService } from '../media/media-url.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { WalletService } from '../wallet/wallet.service';
import { LIVE_DISPUTE_STATUSES, assertDecidable, assertJobDisputable, disputeNumber, partnerAdjustmentEntries } from './domain/dispute-decision';

/* ------------------------------------------------------------- contracts */

export interface DisputeDto {
  id: string;
  number: string;
  jobId: string;
  customerId: string;
  partnerId: string;
  openedByRole: string;
  status: DisputeStatus;
  reason: string;
  description: string;
  requestedRefund: Money | null;
  refund: Money;
  partnerAdjustment: Money;
  decidedById: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  evidenceUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DisputeMessageDto {
  id: string;
  disputeId: string;
  authorId: string;
  authorName: string | null;
  text: string;
  internal: boolean;
  createdAt: string;
}

export interface DisputeDetailDto extends DisputeDto {
  messages: DisputeMessageDto[];
}

export interface DisputeListFilter {
  status?: DisputeStatus;
  jobId?: string;
  customerId?: string;
  partnerId?: string;
  cursor?: string;
  limit: number;
}

const disputeInclude = { evidence: { include: { media: true } } } satisfies Prisma.DisputeInclude;

const disputeMessageInclude = { author: { select: { fullName: true } } } satisfies Prisma.DisputeMessageInclude;

const disputeDetailInclude = {
  evidence: { include: { media: true } },
  messages: { orderBy: { createdAt: 'asc' as const }, include: disputeMessageInclude },
} satisfies Prisma.DisputeInclude;

type DisputeRow = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;
type DisputeDetailRow = Prisma.DisputeGetPayload<{ include: typeof disputeDetailInclude }>;
type DisputeMessageRow = Prisma.DisputeMessageGetPayload<{ include: typeof disputeMessageInclude }>;

const DISPUTE_COUNTER = 'dispute_number';

interface DisputeJob extends JobLike {
  currency: string;
}

/**
 * Disputes over completed work (spec §64). Opening one moves the job to DISPUTED; deciding one is
 * a single flow that records the decision, issues the customer refund, books the partner
 * adjustment in the ledger and returns the job to COMPLETED — audited from end to end.
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService,
  ) {}

  /* -------------------------------------------------------------- opening */

  async open(user: RequestUser, input: OpenDisputeInput): Promise<DisputeDetailDto> {
    const job = await this.loadJob(input.jobId);
    const openedByCustomer = JobPolicy.isCustomer(user, job);
    const openedByPartner = JobPolicy.isAssignedPartner(user, job);
    if (!openedByCustomer && !openedByPartner) throw AppException.forbidden('Only the parties of a job can open a dispute');
    const partnerId = job.partnerId;
    if (!partnerId) throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'This job was never assigned to a partner');

    assertJobDisputable(job.status, openedByCustomer);

    const live = await this.prisma.dispute.findFirst({
      where: { jobId: job.id, status: { in: [...LIVE_DISPUTE_STATUSES] } },
      select: { id: true, number: true },
    });
    if (live) throw AppException.conflict(`Dispute ${live.number} is already open for this job`, ErrorCode.CONFLICT, { disputeId: live.id });

    await this.media.assertOwnedReady(user.id, input.evidenceMediaIds, [MediaPurpose.DISPUTE_EVIDENCE]);

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          number: disputeNumber(await this.prisma.nextCounter(DISPUTE_COUNTER, tx), new Date()),
          jobId: job.id,
          customerId: job.customerId,
          partnerId,
          openedByRole: openedByCustomer ? UserRole.CUSTOMER : UserRole.PARTNER,
          reason: input.reason,
          description: input.description,
          requestedRefundMinor: input.requestedRefundMinor === undefined ? null : BigInt(input.requestedRefundMinor),
          currency: job.currency,
        },
        select: { id: true },
      });
      await this.attachEvidence(tx, created.id, user.id, input.evidenceMediaIds);
      return tx.dispute.findUniqueOrThrow({ where: { id: created.id }, include: disputeDetailInclude });
    });

    // A job that was already paid for moves out of COMPLETED so settlement/payouts pause.
    if (job.status === JobStatus.COMPLETED) {
      await this.jobs.transition(
        job.id,
        JobStatus.DISPUTED,
        { type: JobPolicy.actorTypeFor(user, job), id: user.id },
        { reason: `dispute.opened:${dispute.number}` },
      );
    }

    const otherParty = openedByCustomer ? dispute.partnerId : dispute.customerId;
    await this.notifyParty(otherParty, dispute.id, dispute.number);
    return this.toDetailDto(dispute, { includeInternal: false });
  }

  /* ----------------------------------------------------------- party reads */

  async listMine(user: RequestUser, cursorRaw: string | undefined, limit: number): Promise<Page<DisputeDto>> {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.dispute.findMany({
      where: { ...cursorWhere(cursor), OR: [{ customerId: user.id }, { partnerId: user.id }] },
      include: disputeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (row) => this.toDto(row));
  }

  async getMine(user: RequestUser, id: string): Promise<DisputeDetailDto> {
    const dispute = await this.loadDetail(id);
    const staff = this.isStaff(user);
    if (!staff && !this.isParty(user, dispute)) throw AppException.notFound('Dispute', id);
    return this.toDetailDto(dispute, { includeInternal: staff });
  }

  /* ------------------------------------------------------------- messages */

  async addMessage(user: RequestUser, id: string, input: DisputeMessageInput): Promise<DisputeMessageDto> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      select: { id: true, number: true, status: true, customerId: true, partnerId: true },
    });
    if (!dispute) throw AppException.notFound('Dispute', id);

    const staff = this.isStaff(user);
    if (!staff && !this.isParty(user, dispute)) throw AppException.notFound('Dispute', id);
    // Only staff may leave internal notes; a party-supplied flag is ignored, never honoured.
    const internal = staff && input.internal;

    await this.media.assertOwnedReady(user.id, input.evidenceMediaIds, [MediaPurpose.DISPUTE_EVIDENCE]);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.disputeMessage.create({
        data: { disputeId: dispute.id, authorId: user.id, text: input.text, isInternal: internal },
        select: { id: true },
      });
      await this.attachEvidence(tx, dispute.id, user.id, input.evidenceMediaIds);
      // The first party or agent reply takes the dispute off the untouched pile.
      if (dispute.status === DisputeStatus.OPEN && staff) {
        await tx.dispute.update({ where: { id: dispute.id }, data: { status: DisputeStatus.UNDER_REVIEW } });
      }
      return tx.disputeMessage.findUniqueOrThrow({ where: { id: created.id }, include: disputeMessageInclude });
    });

    if (!internal) {
      const recipients = [dispute.customerId, dispute.partnerId].filter((party) => party !== user.id);
      const senderName = await this.displayName(user.id);
      for (const recipient of recipients) {
        await this.notifications.notify({
          userId: recipient,
          event: NotificationEvent.NEW_MESSAGE,
          vars: { senderName, preview: input.text.slice(0, 60) },
          data: { disputeId: dispute.id },
          collapseKey: `dispute:${dispute.id}`,
        });
      }
    }

    return this.toMessageDto(message);
  }

  /** Adds evidence to a live dispute; parties and staff may both contribute. */
  async addEvidence(user: RequestUser, id: string, mediaIds: string[]): Promise<DisputeDetailDto> {
    const dispute = await this.loadDetail(id);
    const staff = this.isStaff(user);
    if (!staff && !this.isParty(user, dispute)) throw AppException.notFound('Dispute', id);
    if (!LIVE_DISPUTE_STATUSES.includes(dispute.status)) throw AppException.conflict('This dispute was already decided', ErrorCode.CONFLICT);

    await this.media.assertOwnedReady(user.id, mediaIds, [MediaPurpose.DISPUTE_EVIDENCE]);
    await this.prisma.$transaction((tx) => this.attachEvidence(tx, dispute.id, user.id, mediaIds));

    return this.toDetailDto(await this.loadDetail(id), { includeInternal: staff });
  }

  /* ----------------------------------------------------------------- admin */

  async list(filter: DisputeListFilter): Promise<Page<DisputeDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.dispute.findMany({
      where: { ...cursorWhere(cursor), status: filter.status, jobId: filter.jobId, customerId: filter.customerId, partnerId: filter.partnerId },
      include: disputeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toDto(row));
  }

  async get(id: string): Promise<DisputeDetailDto> {
    return this.toDetailDto(await this.loadDetail(id), { includeInternal: true });
  }

  /** Live disputes waiting for a decision — the ops dashboard counter. */
  async openCount(): Promise<number> {
    return this.prisma.dispute.count({ where: { status: { in: [...LIVE_DISPUTE_STATUSES] } } });
  }

  /**
   * Settles a dispute in one flow: record the decision, refund the customer through
   * `PaymentsService`, book the partner adjustment in the ledger, hand the job back to
   * `JobsService` and tell both parties. Idempotency is provided by the ledger key and by the
   * `@Idempotent` guard on the route.
   */
  async decide(id: string, input: DecideDisputeInput, actor: RequestUser, requestId: string | null = null): Promise<DisputeDetailDto> {
    const before = await this.prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
    if (!before) throw AppException.notFound('Dispute', id);
    assertDecidable(before.status);

    const refundMinor = BigInt(input.refundMinor);
    const adjustmentMinor = BigInt(input.partnerAdjustmentMinor);
    const decidedAt = new Date();

    if (refundMinor > 0n) {
      const payment = await this.capturedPaymentFor(before.jobId);
      await this.payments.refund(
        { paymentId: payment.id, amountMinor: Number(refundMinor), reason: input.reason, disputeId: before.id },
        actor,
        requestId,
      );
    }

    if (adjustmentMinor !== 0n) {
      const wallet = await this.wallets.getOrCreate(WalletOwnerType.PARTNER, before.partnerId, before.currency);
      await this.ledger.post({
        type: LedgerTransactionType.DISPUTE_SETTLEMENT,
        currency: before.currency,
        entries: partnerAdjustmentEntries({ adjustmentMinor, currency: before.currency, partnerWalletId: wallet.id }),
        jobId: before.jobId,
        disputeId: before.id,
        reference: before.number,
        description: `Dispute ${before.number} partner adjustment`,
        reason: input.reason,
        actorId: actor.id,
        idempotencyKey: `dispute:${before.id}:partner-adjustment`,
      });
    }

    const decided = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({
        where: { id },
        data: {
          status: input.decision,
          refundMinor,
          partnerAdjustmentMinor: adjustmentMinor,
          decidedById: actor.id,
          decidedAt,
          decisionReason: input.reason,
        },
        include: disputeDetailInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'dispute.decide',
          entity: 'dispute',
          entityId: id,
          oldValue: {
            status: before.status,
            refundMinor: before.refundMinor.toString(),
            partnerAdjustmentMinor: before.partnerAdjustmentMinor.toString(),
          },
          newValue: {
            status: updated.status,
            refundMinor: refundMinor.toString(),
            partnerAdjustmentMinor: adjustmentMinor.toString(),
            jobId: before.jobId,
          },
          reason: input.reason,
          requestId,
        },
        tx,
      );
      return updated;
    });

    await this.restoreJob(before.jobId, actor, before.number);
    await Promise.all([
      this.notifyParty(decided.customerId, decided.id, decided.number),
      this.notifyParty(decided.partnerId, decided.id, decided.number),
    ]);

    this.logger.info(
      { disputeId: id, decision: input.decision, refundMinor: refundMinor.toString(), partnerAdjustmentMinor: adjustmentMinor.toString() },
      'dispute decided',
    );
    return this.toDetailDto(decided, { includeInternal: true });
  }

  /** A decided dispute hands the job back to COMPLETED; anything else is left to the job module. */
  private async restoreJob(jobId: string, actor: RequestUser, number: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job || job.status !== JobStatus.DISPUTED) return;
    await this.jobs.transition(jobId, JobStatus.COMPLETED, { type: JobActorType.ADMIN, id: actor.id }, { reason: `dispute.resolved:${number}` });
  }

  private async capturedPaymentFor(jobId: string): Promise<{ id: string }> {
    const payment = await this.prisma.payment.findFirst({
      where: { jobId, status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED] } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw AppException.badRequest(ErrorCode.PAYMENT_FAILED, 'This job has no captured payment to refund');
    return payment;
  }

  /* ---------------------------------------------------------------- helpers */

  private async loadJob(jobId: string): Promise<DisputeJob> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, partnerId: true, status: true, zoneId: true, currency: true },
    });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  private async loadDetail(id: string): Promise<DisputeDetailRow> {
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: disputeDetailInclude });
    if (!dispute) throw AppException.notFound('Dispute', id);
    return dispute;
  }

  private isParty(user: RequestUser, dispute: { customerId: string; partnerId: string }): boolean {
    return user.id === dispute.customerId || user.id === dispute.partnerId;
  }

  private isStaff(user: RequestUser): boolean {
    return user.isSuperAdmin || user.permissions.includes(Permission.DISPUTES_READ) || user.permissions.includes(Permission.DISPUTES_DECIDE);
  }

  private async attachEvidence(tx: Tx, disputeId: string, uploadedById: string, mediaIds: string[]): Promise<void> {
    if (!mediaIds.length) return;
    await tx.disputeEvidence.createMany({ data: mediaIds.map((mediaId) => ({ disputeId, mediaId, uploadedById })) });
  }

  private async notifyParty(userId: string, disputeId: string, number: string): Promise<void> {
    await this.notifications.notify({
      userId,
      event: NotificationEvent.SUPPORT_REPLY,
      vars: { ticketNumber: number },
      data: { disputeId },
      collapseKey: `dispute:${disputeId}`,
      priority: 'high',
    });
  }

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
    return user?.fullName ?? user?.phone ?? '';
  }

  /* ---------------------------------------------------------------- mapping */

  private toDto(dispute: DisputeRow): DisputeDto {
    return {
      id: dispute.id,
      number: dispute.number,
      jobId: dispute.jobId,
      customerId: dispute.customerId,
      partnerId: dispute.partnerId,
      openedByRole: dispute.openedByRole,
      status: dispute.status,
      reason: dispute.reason,
      description: dispute.description,
      requestedRefund: dispute.requestedRefundMinor === null ? null : toMoney(dispute.requestedRefundMinor, dispute.currency),
      refund: toMoney(dispute.refundMinor, dispute.currency),
      partnerAdjustment: toMoney(dispute.partnerAdjustmentMinor, dispute.currency),
      decidedById: dispute.decidedById,
      decidedAt: dispute.decidedAt ? dispute.decidedAt.toISOString() : null,
      decisionReason: dispute.decisionReason,
      evidenceUrls: dispute.evidence.map((item) => this.mediaUrls.urlFor(item.media, 'medium')),
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
    };
  }

  private toDetailDto(dispute: DisputeDetailRow, opts: { includeInternal: boolean }): DisputeDetailDto {
    const messages = opts.includeInternal ? dispute.messages : dispute.messages.filter((m) => !m.isInternal);
    return { ...this.toDto(dispute), messages: messages.map((m) => this.toMessageDto(m)) };
  }

  private toMessageDto(message: DisputeMessageRow): DisputeMessageDto {
    return {
      id: message.id,
      disputeId: message.disputeId,
      authorId: message.authorId,
      authorName: message.author.fullName,
      text: message.text,
      internal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
