import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, FEATURE_FLAGS, JobActorType, type JobDto, JobStatus, JobStopKind, JobType, MediaPurpose, NotificationEvent, type Page, PaymentMethod, SchedulingMode } from '@tamam/shared-types';
import type { CreateJobInput, JobListFilterInput, PageRequestInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { encrypt, hmacHash, randomDigits } from '../../common/utils/crypto.util';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { AppConfigService } from '../../config';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { DISPATCH_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { CatalogService } from '../catalog/catalog.service';
import { ChatService } from '../chat/chat.service';
import { SystemConfigService } from '../config/system-config.service';
import { MediaService } from '../media/media.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { PromotionsService } from '../promotions/promotions.service';
import { RiskService } from '../risk/risk.service';
import { ZonesService } from '../zones/zones.service';
import { JobDomainEvents, type JobStatusChangedEvent } from './domain/job-events';
import { formatJobNumber } from './domain/job-number';
import { JobPolicy } from './domain/job-policy';
import { JobStateMachine } from './domain/job-state-machine';
import { JobMapper } from './job.mapper';
import { type JobWithRelations, jobInclude } from './jobs.types';

export interface TransitionActor {
  type: JobActorType;
  id: string | null;
}

export interface TransitionOptions {
  reason?: string;
  data?: Record<string, unknown>;
  expectedVersion?: number;
  requestId?: string | null;
  /** Extra columns to set atomically with the status change. */
  patch?: Prisma.JobUpdateInput;
  location?: { lat: number; lng: number };
  eventType?: string;
}

/**
 * Universal Job Engine (spec §7, §17–§40). One entity for RIDE / DELIVERY / HOME_SERVICE; the
 * state machine, versioning and event log are shared, type-specific behaviour lives in
 * JobLifecycleService. Every status change goes through `transition()`.
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
    private readonly sysConfig: SystemConfigService,
    private readonly zones: ZonesService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly promotions: PromotionsService,
    private readonly media: MediaService,
    private readonly risk: RiskService,
    private readonly notifications: NotificationsService,
    private readonly metrics: MetricsService,
    private readonly mapper: JobMapper,
    private readonly events: EventEmitter2,
    private readonly logger: Logger,
    @Inject(forwardRef(() => PaymentsService)) private readonly payments: PaymentsService,
    @Inject(forwardRef(() => ChatService)) private readonly chat: ChatService,
    @InjectQueue(QUEUES.DISPATCH) private readonly dispatchQueue: Queue,
  ) {}

  /* ------------------------------------------------------------- reads */
  async getRaw(jobId: string, tx?: Tx): Promise<JobWithRelations> {
    const job = await (tx ?? this.prisma).job.findUnique({ where: { id: jobId }, include: jobInclude });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  /** Policy-checked read (spec §88). */
  async getForUser(jobId: string, user: RequestUser): Promise<JobWithRelations> {
    const job = await this.getRaw(jobId);
    if (!JobPolicy.canView(user, job)) throw AppException.notFound('Job', jobId); // 404, not 403: don't leak existence
    return job;
  }

  async getDto(jobId: string, user: RequestUser, withTimeline = false): Promise<JobDto> {
    const job = await this.getForUser(jobId, user);
    const events = withTimeline ? await this.prisma.jobEvent.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } }) : undefined;
    return this.mapper.toDto(job, user, events);
  }

  toDto(job: JobWithRelations, user: RequestUser): JobDto {
    return this.mapper.toDto(job, user);
  }

  async listForUser(user: RequestUser, filter: JobListFilterInput & PageRequestInput): Promise<Page<JobDto>> {
    const cursor = decodeCursor(filter.cursor);
    const isStaff = JobPolicy.isStaff(user);
    const statusGroup =
      filter.statusGroup === 'active' ? { in: ['REQUESTED', 'SEARCHING', 'ASSIGNED', 'PARTNER_EN_ROUTE', 'PARTNER_ARRIVED', 'WAITING_CUSTOMER', 'IN_PROGRESS', 'INSPECTION_STARTED', 'QUOTE_REQUIRED', 'QUOTE_SUBMITTED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'WORK_STARTED', 'WAITING_FOR_PARTS', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED'] as JobStatus[] }
      : filter.statusGroup === 'completed' ? { in: [JobStatus.COMPLETED] }
      : filter.statusGroup === 'cancelled' ? { in: [JobStatus.CANCELLED, JobStatus.NO_PARTNER_AVAILABLE] }
      : undefined;
    const rows = await this.prisma.job.findMany({
      where: {
        ...cursorWhere(cursor),
        ...(isStaff ? { customerId: filter.customerId, partnerId: filter.partnerId, zoneId: filter.zoneId } : user.partnerId && user.roles.includes('PARTNER') && !user.roles.includes('CUSTOMER') ? { partnerId: user.partnerId } : { customerId: user.id }),
        type: filter.type,
        status: filter.status ?? statusGroup,
        createdAt: filter.from || filter.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined,
        ...(filter.q ? { OR: [{ number: { contains: filter.q.toUpperCase() } }, { customer: { user: { phone: { contains: filter.q } } } }] } : {}),
      },
      include: jobInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (j) => this.mapper.toDto(j, user));
  }

  /* ------------------------------------------------------------ create */
  async create(user: RequestUser, input: CreateJobInput, requestId: string | null): Promise<JobDto> {
    if (!user.customerId) throw AppException.forbidden('Only customers can create jobs');
    await this.risk.assertCanCreateJob(user.id, user.deviceId);
    const est = await this.pricing.getEstimate(input.estimateId, user.id);
    if (est.jobType !== input.type) throw AppException.validation([{ field: 'estimateId', message: 'estimate does not match job type' }]);

    const maxActive = await this.sysConfig.getNumber(CONFIG_KEYS.JOB_MAX_ACTIVE_PER_CUSTOMER);
    const active = await this.prisma.job.count({ where: { customerId: user.id, status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.NO_PARTNER_AVAILABLE, JobStatus.DISPUTED, JobStatus.DRAFT] } } });
    if (active >= maxActive) throw AppException.conflict(`You already have ${active} active requests`, ErrorCode.CONFLICT);

    if (input.scheduling === SchedulingMode.SCHEDULED) {
      await this.sysConfig.assertEnabled(FEATURE_FLAGS.SCHEDULED_JOBS, { userId: user.id, zoneId: est.zoneId });
      if (!input.scheduledFor || new Date(input.scheduledFor).getTime() < Date.now() + 15 * 60_000) throw AppException.validation([{ field: 'scheduledFor', message: 'must be at least 15 minutes in the future' }]);
    }
    await this.assertPaymentMethod(user, input.paymentMethod, est.zoneId);

    // Option (vehicle type or category) must belong to the estimate; server computed prices only.
    const optionKey = input.type === JobType.HOME_SERVICE ? est.categoryId ?? '' : (input as { vehicleTypeId?: string }).vehicleTypeId ?? '';
    if (!optionKey) throw AppException.validation([{ field: 'vehicleTypeId', message: 'required' }]);

    // Promo evaluation (server-side, spec §60)
    let promo: { promoCodeId: string; discountMinor: bigint } | null = null;
    if (input.promoCode) {
      await this.risk.assertCanUsePromo(user.id, user.deviceId);
      const option = est.options.find((o) => o.key === optionKey);
      const result = await this.promotions.evaluate(input.promoCode, { userId: user.id, jobType: est.jobType, categoryId: est.categoryId, zoneId: est.zoneId, paymentMethod: input.paymentMethod, subtotalMinor: BigInt(option?.subtotalMinor ?? '0'), currency: est.currency });
      promo = { promoCodeId: result.promoCodeId, discountMinor: result.discountMinor };
    }

    // Type-specific validation before the transaction
    let category: Awaited<ReturnType<CatalogService['getCategory']>> | null = null;
    let dynamicFields: Record<string, unknown> = {};
    const mediaIds = 'mediaIds' in input ? input.mediaIds : [];
    if (input.type === JobType.HOME_SERVICE) {
      category = await this.catalog.getCategory(input.categoryId);
      if (est.categoryId !== input.categoryId) throw AppException.validation([{ field: 'categoryId', message: 'does not match estimate' }]);
      dynamicFields = this.catalog.validateDynamicFields(category, input.dynamicFields);
      const reqMedia = category.requiredMedia as { minImages: number; maxImages: number };
      const images = mediaIds.length;
      if (images < reqMedia.minImages) throw AppException.validation([{ field: 'mediaIds', message: `at least ${reqMedia.minImages} photo(s) required` }]);
      if (images > reqMedia.maxImages) throw AppException.validation([{ field: 'mediaIds', message: `at most ${reqMedia.maxImages} photos` }]);
    }
    if (mediaIds.length) await this.media.assertOwnedReady(user.id, mediaIds, [MediaPurpose.JOB_ATTACHMENT]);

    const [tripPinEnabled, pickupOtpEnabled, deliveryOtpEnabled] = await Promise.all([
      this.sysConfig.getBoolean(CONFIG_KEYS.JOB_TRIP_PIN_ENABLED).then(async (v) => v && (await this.sysConfig.isEnabled(FEATURE_FLAGS.TRIP_PIN, { userId: user.id, zoneId: est.zoneId }))),
      this.sysConfig.getBoolean(CONFIG_KEYS.JOB_PICKUP_OTP_ENABLED),
      this.sysConfig.getBoolean(CONFIG_KEYS.JOB_DELIVERY_OTP_ENABLED),
    ]);
    const key = this.config.encryptionKey;
    const pepper = this.config.env.OTP_PEPPER;
    const tripPin = input.type === JobType.RIDE && tripPinEnabled ? randomDigits(4) : null;
    const pickupOtp = input.type === JobType.DELIVERY && pickupOtpEnabled ? randomDigits(4) : null;
    const deliveryOtp = input.type === JobType.DELIVERY && deliveryOtpEnabled ? randomDigits(4) : null;

    const jobId = await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.pricing.createSnapshot(est, optionKey, promo?.discountMinor ?? 0n, tx);
      const seq = await this.prisma.nextCounter('job_number', tx);
      const now = new Date();
      const stops: Prisma.JobStopCreateWithoutJobInput[] = [];
      const addr = (a: { lat: number; lng: number; formatted: string; street?: string; building?: string; floor?: string; apartment?: string; city?: string; notes?: string; placeId?: string }, sequence: number, kind: JobStopKind, contact?: { name: string; phone: string }): Prisma.JobStopCreateWithoutJobInput => ({
        sequence, kind, formatted: a.formatted, street: a.street ?? null, building: a.building ?? null, floor: a.floor ?? null, apartment: a.apartment ?? null, city: a.city ?? null, notes: a.notes ?? null, placeId: a.placeId ?? null,
        lat: new Prisma.Decimal(a.lat), lng: new Prisma.Decimal(a.lng), contactName: contact?.name ?? null, contactPhoneEnc: contact ? encrypt(contact.phone, key) : null,
      });
      if (input.type === JobType.RIDE) {
        stops.push(addr(input.pickup, 0, JobStopKind.PICKUP), addr(input.destination, 1, JobStopKind.DROPOFF));
      } else if (input.type === JobType.DELIVERY) {
        stops.push(addr(input.pickup, 0, JobStopKind.PICKUP, input.sender), addr(input.destination, 1, JobStopKind.DROPOFF, input.recipient));
      } else {
        stops.push(addr(input.location, 0, JobStopKind.SERVICE_LOCATION));
      }

      const job = await tx.job.create({
        data: {
          number: formatJobNumber(seq, now),
          type: input.type,
          status: JobStatus.REQUESTED,
          version: 1,
          customerId: user.id,
          vehicleTypeId: input.type === JobType.HOME_SERVICE ? null : snapshot.option.vehicleTypeId,
          categoryId: est.categoryId,
          subcategoryId: est.subcategoryId,
          zoneId: est.zoneId,
          scheduling: input.scheduling,
          scheduledFor: input.scheduling === SchedulingMode.SCHEDULED && input.scheduledFor ? new Date(input.scheduledFor) : null,
          urgency: est.urgency,
          currency: est.currency,
          paymentMethod: input.paymentMethod,
          estimatedTotalMinor: snapshot.totalMinor,
          breakdown: snapshot.breakdown as unknown as Prisma.InputJsonValue,
          pricingSnapshotId: snapshot.snapshotId,
          distanceMeters: est.distanceMeters || null,
          durationSeconds: est.durationSeconds || null,
          routePolyline: est.routePolyline,
          etaToPickupSeconds: snapshot.option.etaToPickupSeconds,
          description: 'description' in input ? (input.description ?? null) : null,
          notes: input.notes ?? null,
          dynamicFields: dynamicFields as Prisma.InputJsonValue,
          preferredDate: input.type === JobType.HOME_SERVICE && input.preferredDate ? new Date(input.preferredDate) : null,
          preferredTimeSlot: input.type === JobType.HOME_SERVICE ? (input.preferredTimeSlot ?? null) : null,
          tripPinRequired: !!tripPin,
          tripPinHash: tripPin ? hmacHash(tripPin, pepper) : null,
          tripPinEnc: tripPin ? encrypt(tripPin, key) : null,
          pickupOtpRequired: !!pickupOtp,
          pickupOtpHash: pickupOtp ? hmacHash(pickupOtp, pepper) : null,
          pickupOtpEnc: pickupOtp ? encrypt(pickupOtp, key) : null,
          deliveryOtpRequired: !!deliveryOtp,
          deliveryOtpHash: deliveryOtp ? hmacHash(deliveryOtp, pepper) : null,
          deliveryOtpEnc: deliveryOtp ? encrypt(deliveryOtp, key) : null,
          promoCodeId: promo?.promoCodeId ?? null,
          promoDiscountMinor: promo?.discountMinor ?? 0n,
          stops: { create: stops },
          media: mediaIds.length ? { create: mediaIds.map((mediaId, i) => ({ mediaId, context: 'PROBLEM', sortOrder: i })) } : undefined,
          serviceOptions: input.type === JobType.HOME_SERVICE && input.optionIds.length && category
            ? { create: input.optionIds.map((optionId) => { const o = category?.subcategories.flatMap((s) => s.options).find((x) => x.id === optionId); return { optionId, priceMinor: o?.priceMinor ?? 0n }; }) }
            : undefined,
          delivery: input.type === JobType.DELIVERY && est.packageCategoryId
            ? { create: { packageCategoryId: est.packageCategoryId, approximateSize: input.approximateSize, approximateWeightKg: input.approximateWeightKg ?? null, senderName: input.sender.name, senderPhoneEnc: encrypt(input.sender.phone, key), recipientName: input.recipient.name, recipientPhoneEnc: encrypt(input.recipient.phone, key), deliveryNotes: input.deliveryNotes ?? null } }
            : undefined,
        },
      });

      await tx.jobEvent.createMany({
        data: [
          { jobId: job.id, type: 'job.created', fromStatus: null, toStatus: JobStatus.DRAFT, actorType: JobActorType.CUSTOMER, actorId: user.id, data: { estimateId: est.id, optionKey } as Prisma.InputJsonValue, requestId },
          { jobId: job.id, type: 'job.requested', fromStatus: JobStatus.DRAFT, toStatus: JobStatus.REQUESTED, actorType: JobActorType.CUSTOMER, actorId: user.id, requestId },
        ],
      });
      if (promo) await this.promotions.reserve(job.id, promo.promoCodeId, user.id, promo.discountMinor, est.currency, tx);
      await this.payments.createForJob({ id: job.id, customerId: user.id, currency: job.currency, paymentMethod: job.paymentMethod, estimatedTotalMinor: job.estimatedTotalMinor }, tx);
      await this.chat.ensureForJob(job.id, tx);
      await tx.customerProfile.updateMany({ where: { userId: user.id, firstJobAt: null }, data: { firstJobAt: now } });
      return job.id;
    });

    this.metrics.jobsCreated.inc({ type: input.type });
    this.events.emit(JobDomainEvents.CREATED, { jobId, jobType: input.type, customerId: user.id, zoneId: est.zoneId, scheduling: input.scheduling, scheduledFor: input.scheduledFor ?? null });
    await this.notifications.notify({ userId: user.id, event: NotificationEvent.JOB_CREATED, jobId, vars: { jobNumber: (await this.prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { number: true } })).number } });

    if (input.scheduling === SchedulingMode.SCHEDULED && input.scheduledFor) {
      const lead = await this.sysConfig.getNumber(CONFIG_KEYS.DISPATCH_SCHEDULED_LEAD_MIN);
      const delay = Math.max(0, new Date(input.scheduledFor).getTime() - lead * 60_000 - Date.now());
      await this.dispatchQueue.add(DISPATCH_JOBS.SCHEDULED_KICKOFF, { jobId }, { delay, jobId: `kickoff-${jobId}` });
    } else {
      await this.dispatchQueue.add(DISPATCH_JOBS.WAVE, { jobId, wave: 1 }, { jobId: `wave-${jobId}-1` });
    }
    await this.redisEstimateConsume(est.id);
    return this.getDto(jobId, user);
  }

  private async redisEstimateConsume(estimateId: string): Promise<void> {
    // Estimates are single-use to avoid replaying a stale price after creation.
    await this.redis.del(`estimate:${estimateId}`);
  }

  private async assertPaymentMethod(user: RequestUser, method: PaymentMethod, zoneId: string): Promise<void> {
    if (method === PaymentMethod.CARD || method === PaymentMethod.EXTERNAL_GATEWAY) {
      await this.sysConfig.assertEnabled(FEATURE_FLAGS.CARD_PAYMENTS, { userId: user.id, zoneId });
      if (this.config.env.PAYMENT_GATEWAY_PROVIDER === 'none') throw AppException.badRequest(ErrorCode.PAYMENT_METHOD_DISABLED, 'Online payments are not enabled');
    } else if (method === PaymentMethod.WALLET) {
      await this.sysConfig.assertEnabled(FEATURE_FLAGS.WALLET_PAYMENTS, { userId: user.id, zoneId });
      await this.risk.assertCanUseWallet(user.id, user.deviceId);
    } else if (method === PaymentMethod.BANK) {
      throw AppException.badRequest(ErrorCode.PAYMENT_METHOD_DISABLED, 'Bank transfer is not available for jobs');
    }
  }

  /* -------------------------------------------------------- transition */
  /**
   * Atomic, versioned, audited status change. Locks the job row, validates the transition against
   * JOB_TRANSITIONS for the actor, applies `patch`, writes the immutable job_events row and emits
   * `job.status_changed` (+ specific events) AFTER commit.
   */
  async transition(jobId: string, to: JobStatus, actor: TransitionActor, opts: TransitionOptions = {}): Promise<JobWithRelations> {
    const result = await this.prisma.$transaction((tx) => this.transitionInTx(tx, jobId, to, actor, opts));
    result.emit();
    return result.updated;
  }

  /**
   * Same as `transition` but inside a caller-owned transaction (dispatch accept path). The caller
   * MUST call `emit()` after its transaction commits so listeners observe committed rows.
   */
  async transitionInTx(tx: Tx, jobId: string, to: JobStatus, actor: TransitionActor, opts: TransitionOptions = {}): Promise<{ updated: JobWithRelations; from: JobStatus; emit: () => void }> {
    const locked = await tx.$queryRaw<Array<{ id: string; type: JobType; status: JobStatus; version: number }>>`SELECT id, type, status, version FROM jobs WHERE id = ${jobId}::uuid FOR UPDATE`;
    const current = locked[0];
    if (!current) throw AppException.notFound('Job', jobId);
    if (opts.expectedVersion !== undefined && opts.expectedVersion !== current.version) throw AppException.versionConflict();
    const transition = JobStateMachine.assert(current, to, actor.type);
    const now = new Date();
    const timestamps: Prisma.JobUpdateInput = {};
    if (to === JobStatus.SEARCHING && !opts.patch?.dispatchStartedAt) timestamps.dispatchStartedAt = now;
    if (to === JobStatus.ASSIGNED) timestamps.assignedAt = now;
    if (to === JobStatus.PARTNER_ARRIVED) timestamps.partnerArrivedAt = now;
    if (to === JobStatus.IN_PROGRESS || to === JobStatus.INSPECTION_STARTED) timestamps.startedAt = now;
    if (to === JobStatus.COMPLETED) timestamps.completedAt = now;
    if (to === JobStatus.CANCELLED) timestamps.cancelledAt = now;
    if (to === JobStatus.SEARCHING && (current.status === JobStatus.ASSIGNED || current.status === JobStatus.PARTNER_EN_ROUTE || current.status === JobStatus.PARTNER_ARRIVED || current.status === JobStatus.WAITING_CUSTOMER)) {
      timestamps.partner = { disconnect: true };
      timestamps.vehicle = { disconnect: true };
      timestamps.assignedAt = null;
      timestamps.partnerArrivedAt = null;
    }
    const updated = await tx.job.update({
      where: { id: jobId, version: current.version },
      data: { status: to, version: { increment: 1 }, ...timestamps, ...(opts.patch ?? {}) },
      include: jobInclude,
    });
    await tx.jobEvent.create({
      data: {
        jobId,
        type: opts.eventType ?? transition.event,
        fromStatus: current.status,
        toStatus: to,
        actorType: actor.type,
        actorId: actor.id,
        data: { ...(opts.data ?? {}), ...(opts.reason ? { reason: opts.reason } : {}) } as Prisma.InputJsonValue,
        lat: opts.location ? new Prisma.Decimal(opts.location.lat) : null,
        lng: opts.location ? new Prisma.Decimal(opts.location.lng) : null,
        requestId: opts.requestId ?? null,
      },
    });
    const from = current.status;
    const emit = () => {
      const payload: JobStatusChangedEvent = { jobId, jobType: updated.type, from, to, actorType: actor.type, actorId: actor.id, customerId: updated.customerId, partnerId: updated.partnerId, zoneId: updated.zoneId, at: new Date().toISOString() };
      this.events.emit(JobDomainEvents.STATUS_CHANGED, payload);
      if (to === JobStatus.ASSIGNED) this.events.emit(JobDomainEvents.ASSIGNED, payload);
      if (to === JobStatus.COMPLETED) this.events.emit(JobDomainEvents.COMPLETED, payload);
      if (to === JobStatus.CANCELLED) this.events.emit(JobDomainEvents.CANCELLED, payload);
      if (to === JobStatus.NO_PARTNER_AVAILABLE) this.events.emit(JobDomainEvents.NO_PARTNER, payload);
      if (to === JobStatus.IN_PROGRESS || to === JobStatus.INSPECTION_STARTED) this.events.emit(JobDomainEvents.STARTED, payload);
      if (to === JobStatus.SEARCHING && from !== JobStatus.REQUESTED && from !== JobStatus.NO_PARTNER_AVAILABLE) this.events.emit(JobDomainEvents.UNASSIGNED, payload);
    };
    return { updated, from, emit };
  }

  /** Non-status metadata updates (ETA refresh etc.) without a transition. */
  async patch(jobId: string, data: Prisma.JobUpdateInput, tx?: Tx): Promise<void> {
    await (tx ?? this.prisma).job.update({ where: { id: jobId }, data });
  }

  async addEvent(jobId: string, type: string, actor: TransitionActor, data?: Record<string, unknown>, tx?: Tx): Promise<void> {
    await (tx ?? this.prisma).jobEvent.create({ data: { jobId, type, actorType: actor.type, actorId: actor.id, data: (data ?? {}) as Prisma.InputJsonValue } });
  }

  async timeline(jobId: string, user: RequestUser) {
    const job = await this.getForUser(jobId, user);
    const events = await this.prisma.jobEvent.findMany({ where: { jobId: job.id }, orderBy: { createdAt: 'asc' } });
    return this.mapper.toDto(job, user, events).events ?? [];
  }

  /** Used by JobMapper consumers that need the raw counter for logging. */
  logTransitionFailure(jobId: string, err: unknown): void {
    this.logger.warn({ jobId, err }, 'job transition failed');
  }
}
