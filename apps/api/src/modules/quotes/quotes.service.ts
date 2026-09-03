import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, JobActorType, JobStatus, JobType, NotificationEvent, type QuoteDto, QuoteKind, QuoteStatus } from '@tamam/shared-types';
import type { DecideQuoteInput, SubmitQuoteInput } from '@tamam/validation';
import type { Queue } from 'bullmq';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { formatMajor, percentOf } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JOB_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { SystemConfigService } from '../config/system-config.service';
import { JobPolicy } from '../jobs/domain/job-policy';
import { JobMapper } from '../jobs/job.mapper';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';

/**
 * Quote system (spec §41–§44): every submission is an immutable revision; work cannot start
 * without an approved quote; additional work is a CHANGE_ORDER that also needs approval.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
    private readonly notifications: NotificationsService,
    private readonly mapper: JobMapper,
    private readonly events: EventEmitter2,
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService,
    @Inject(forwardRef(() => PricingService)) private readonly pricing: PricingService,
    @InjectQueue(QUEUES.JOBS) private readonly queue: Queue,
  ) {}

  async listForJob(jobId: string, user: RequestUser): Promise<QuoteDto[]> {
    const job = await this.jobs.getForUser(jobId, user);
    const rows = await this.prisma.serviceQuote.findMany({ where: { jobId }, include: { items: true }, orderBy: { revision: 'asc' } });
    return rows.map((q) => this.mapper.quoteToDto(q, job.currency as never));
  }

  /** Technician submits an initial quote (from QUOTE_REQUIRED / QUOTE_REJECTED) or a change order (from WORK_STARTED). */
  async submit(jobId: string, user: RequestUser, input: SubmitQuoteInput, requestId: string | null): Promise<QuoteDto> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isAssignedPartner(user, job)) throw AppException.forbidden('Only the assigned technician can quote');
    if (job.type !== JobType.HOME_SERVICE) throw AppException.invalidTransition(job.status, JobStatus.QUOTE_SUBMITTED);
    const isChangeOrder = input.kind === 'CHANGE_ORDER' || job.status === JobStatus.WORK_STARTED;
    if (isChangeOrder && job.status !== JobStatus.WORK_STARTED && job.status !== JobStatus.WAITING_FOR_PARTS) throw AppException.invalidTransition(job.status, JobStatus.QUOTE_SUBMITTED);
    if (!isChangeOrder && job.status !== JobStatus.QUOTE_REQUIRED && job.status !== JobStatus.QUOTE_REJECTED && job.status !== JobStatus.INSPECTION_STARTED) throw AppException.invalidTransition(job.status, JobStatus.QUOTE_SUBMITTED);

    const rule = job.pricingSnapshot ? await this.prisma.pricingSnapshot.findUnique({ where: { id: job.pricingSnapshot.id }, select: { rule: true } }) : null;
    const taxPercent = ((rule?.rule as { taxPercent?: number } | null)?.taxPercent) ?? 0;
    const items = input.items.map((i, idx) => {
      const qty = new Prisma.Decimal(i.quantity);
      const total = BigInt(Math.round(i.quantity * i.unitPriceMinor));
      return { kind: i.kind, description: i.description, quantity: qty, unitPriceMinor: BigInt(i.unitPriceMinor), totalMinor: total, sortOrder: idx };
    });
    const labor = items.filter((i) => i.kind === 'LABOR').reduce((s, i) => s + i.totalMinor, 0n);
    const parts = items.filter((i) => i.kind === 'PARTS').reduce((s, i) => s + i.totalMinor, 0n);
    const fees = items.filter((i) => i.kind === 'FEE').reduce((s, i) => s + i.totalMinor, 0n);
    const discount = BigInt(input.discountMinor);
    const net = labor + parts + fees - discount;
    if (net < 0n) throw AppException.validation([{ field: 'discountMinor', message: 'discount exceeds quote' }]);
    const tax = taxPercent > 0 ? percentOf(net, taxPercent) : 0n;
    const total = net + tax;

    const quote = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.serviceQuote.findFirst({ where: { jobId, status: { in: [QuoteStatus.SUBMITTED, QuoteStatus.REJECTED] } }, orderBy: { revision: 'desc' } });
      const lastRevision = await tx.serviceQuote.aggregate({ where: { jobId }, _max: { revision: true } });
      if (previous && previous.status === QuoteStatus.SUBMITTED) await tx.serviceQuote.update({ where: { id: previous.id }, data: { status: QuoteStatus.SUPERSEDED } });
      const created = await tx.serviceQuote.create({
        data: {
          jobId, partnerId: user.partnerId ?? user.id, kind: isChangeOrder ? QuoteKind.CHANGE_ORDER : QuoteKind.INITIAL, revision: (lastRevision._max.revision ?? 0) + 1, status: QuoteStatus.SUBMITTED, supersedesQuoteId: previous?.id ?? null,
          currency: job.currency, laborCostMinor: labor, partsCostMinor: parts, additionalFeesMinor: fees, discountMinor: discount, taxMinor: tax, totalMinor: total,
          description: input.description ?? null, estimatedDurationMin: input.estimatedDurationMin ?? null, items: { create: items },
        },
        include: { items: true },
      });
      await this.jobs.transitionInTx(tx, jobId, JobStatus.QUOTE_SUBMITTED, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, eventType: isChangeOrder ? 'change_order.submitted' : 'quote.submitted', data: { quoteId: created.id, revision: created.revision, totalMinor: Number(total) } }).then((t) => t.emit());
      return created;
    });

    const timeoutHours = await this.config.getNumber(CONFIG_KEYS.JOB_QUOTE_RESPONSE_TIMEOUT_H);
    await this.queue.add(JOB_JOBS.QUOTE_RESPONSE_TIMEOUT, { jobId, quoteId: quote.id }, { delay: timeoutHours * 3600 * 1000, jobId: `quote-timeout-${quote.id}` });
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.QUOTE_RECEIVED, jobId, priority: 'high', vars: { partnerName: job.partner?.user.fullName ?? '', total: formatMajor(total, job.currency) }, data: { quoteId: quote.id } });
    this.events.emit('quote.submitted', { jobId, quoteId: quote.id, partnerId: user.id, totalMinor: total.toString(), kind: quote.kind });
    return this.mapper.quoteToDto(quote, job.currency as never);
  }

  /** Customer approves or rejects the latest submitted quote. */
  async decide(jobId: string, user: RequestUser, input: DecideQuoteInput, requestId: string | null): Promise<QuoteDto> {
    const job = await this.jobs.getForUser(jobId, user);
    const isCustomer = JobPolicy.isCustomer(user, job);
    const isStaff = JobPolicy.isStaff(user);
    if (!isCustomer && !isStaff) throw AppException.forbidden();
    if (job.status !== JobStatus.QUOTE_SUBMITTED) throw AppException.invalidTransition(job.status, input.decision === 'APPROVE' ? JobStatus.QUOTE_APPROVED : JobStatus.QUOTE_REJECTED);
    const quote = await this.prisma.serviceQuote.findFirst({ where: { jobId, status: QuoteStatus.SUBMITTED }, include: { items: true }, orderBy: { revision: 'desc' } });
    if (!quote) throw AppException.badRequest(ErrorCode.QUOTE_NOT_APPROVED, 'No pending quote');
    const actor = { type: isStaff ? JobActorType.ADMIN : JobActorType.CUSTOMER, id: user.id };
    const approve = input.decision === 'APPROVE';
    const isChangeOrder = quote.kind === QuoteKind.CHANGE_ORDER;

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.serviceQuote.update({ where: { id: quote.id }, data: { status: approve ? QuoteStatus.APPROVED : QuoteStatus.REJECTED, decidedAt: new Date(), decidedById: user.id, decisionNote: input.note ?? null }, include: { items: true } });
      if (approve && isChangeOrder) {
        // Previously approved quote is superseded by the change order's cumulative total.
        await tx.serviceQuote.updateMany({ where: { jobId, status: QuoteStatus.APPROVED, id: { not: q.id } }, data: { status: QuoteStatus.SUPERSEDED } });
      }
      const target = approve ? JobStatus.QUOTE_APPROVED : JobStatus.QUOTE_REJECTED;
      const t = await this.jobs.transitionInTx(tx, jobId, target, actor, { expectedVersion: input.version, requestId, reason: input.note, data: { quoteId: q.id, revision: q.revision } });
      if (approve && isChangeOrder) {
        // Work was already in progress: go straight back to WORK_STARTED.
        const t2 = await this.jobs.transitionInTx(tx, jobId, JobStatus.WORK_STARTED, { type: JobActorType.PARTNER, id: job.partnerId }, { eventType: 'work.resumed_after_change_order', data: { quoteId: q.id } });
        t.emit();
        t2.emit();
      } else {
        t.emit();
      }
      // Keep the job's estimated total in sync for partner earnings previews / receipts.
      if (approve) await tx.job.update({ where: { id: jobId }, data: { estimatedTotalMinor: q.totalMinor } });
      return q;
    });

    await this.queue.remove(`quote-timeout-${quote.id}`).catch(() => undefined);
    if (job.partnerId) {
      await this.notifications.notify({ userId: job.partnerId, event: approve ? NotificationEvent.QUOTE_APPROVED : NotificationEvent.QUOTE_REJECTED, jobId, priority: 'high', vars: { total: formatMajor(updated.totalMinor, job.currency) } });
    }
    this.events.emit('quote.decided', { jobId, quoteId: updated.id, decision: input.decision, actorId: user.id });
    return this.mapper.quoteToDto(updated, job.currency as never);
  }

  /** Scheduler: a quote unanswered past the window is auto-rejected and the job closed as inspection-only. */
  async onResponseTimeout(quoteId: string): Promise<void> {
    const quote = await this.prisma.serviceQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.status !== QuoteStatus.SUBMITTED) return;
    const job = await this.jobs.getRaw(quote.jobId);
    if (job.status !== JobStatus.QUOTE_SUBMITTED) return;
    await this.prisma.serviceQuote.update({ where: { id: quoteId }, data: { status: QuoteStatus.REJECTED, decidedAt: new Date(), decisionNote: 'auto_rejected_timeout' } });
    await this.jobs.transition(job.id, JobStatus.QUOTE_REJECTED, { type: JobActorType.SYSTEM, id: null }, { eventType: 'quote.timeout', data: { quoteId } });
    if (job.partnerId) await this.notifications.notify({ userId: job.partnerId, event: NotificationEvent.QUOTE_REJECTED, jobId: job.id, vars: {} });
  }

  /** Customer declines to proceed after a rejected quote: job completes with inspection fee only (spec §41). */
  async closeInspectionOnly(jobId: string, user: RequestUser, version: number, requestId: string | null): Promise<void> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isCustomer(user, job) && !JobPolicy.isStaff(user)) throw AppException.forbidden();
    if (job.status !== JobStatus.QUOTE_REJECTED) throw AppException.invalidTransition(job.status, JobStatus.COMPLETED);
    const fare = await this.pricing.finalizeFare(job, { quote: null, optionsMinor: 0n });
    await this.jobs.transition(jobId, JobStatus.COMPLETED, { type: JobPolicy.actorTypeFor(user, job), id: user.id }, { expectedVersion: version, requestId, eventType: 'job.completed_inspection_only', patch: { finalTotalMinor: fare.totalMinor, breakdown: fare.breakdown as unknown as Prisma.InputJsonValue } });
    this.events.emit('job.inspection_only_completed', { jobId });
  }
}
