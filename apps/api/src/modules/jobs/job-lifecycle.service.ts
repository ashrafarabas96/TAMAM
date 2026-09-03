import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, JobActorType, type JobDto, JobStatus, JobType, MediaPurpose, NotificationEvent } from '@tamam/shared-types';
import type { ArriveJobInput, CancelJobInput, CompleteJobInput, SimpleTransitionInput, StartJobInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { hmacHash, safeEqual } from '../../common/utils/crypto.util';
import { haversineMeters } from '../../common/utils/geo';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JOB_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { SystemConfigService } from '../config/system-config.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerAvailabilityService } from '../partners/partner-availability.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { PromotionsService } from '../promotions/promotions.service';
import { TrackingService } from '../tracking/tracking.service';

import { JobPolicy } from './domain/job-policy';
import { JobStateMachine } from './domain/job-state-machine';
import { JobsService, type TransitionActor } from './jobs.service';
import type { JobWithRelations } from './jobs.types';

/** Exactly what `PricingService.cancellationFee` returns — kept derived so the two never drift. */
type CancellationFee = Awaited<ReturnType<PricingService['cancellationFee']>>;

/**
 * Type-specific job behaviour on top of JobsService.transition(): arrival geofence, trip PIN,
 * pickup/delivery OTP, proof of delivery, fare finalisation, cancellation policy, home-service
 * work/confirmation flow (spec §27–§33, §40, §44, §59).
 */
@Injectable()
export class JobLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly sysConfig: SystemConfigService,
    private readonly jobs: JobsService,
    private readonly pricing: PricingService,
    private readonly promotions: PromotionsService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
    private readonly logger: PinoLogger,
    @Inject(forwardRef(() => DispatchService)) private readonly dispatch: DispatchService,
    @Inject(forwardRef(() => TrackingService)) private readonly tracking: TrackingService,
    @Inject(forwardRef(() => PaymentsService)) private readonly payments: PaymentsService,
    @Inject(forwardRef(() => PartnerAvailabilityService)) private readonly availability: PartnerAvailabilityService,
    @InjectQueue(QUEUES.JOBS) private readonly queue: Queue,
  ) {}

  /* ------------------------------------------------------------ cancel */
  async cancel(jobId: string, user: RequestUser, input: CancelJobInput, requestId: string | null): Promise<JobDto> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.canCancel(user, job)) throw AppException.forbidden();
    const actorType = JobPolicy.actorTypeFor(user, job);
    if (!JobStateMachine.can(job, JobStatus.CANCELLED, actorType)) throw AppException.invalidTransition(job.status, JobStatus.CANCELLED);
    if (actorType === JobActorType.PARTNER && (input.reasonCode === 'CUSTOMER_NO_SHOW' || input.reasonCode === 'CUSTOMER_UNREACHABLE')) await this.assertNoShowAllowed(job);

    const fee = await this.pricing.cancellationFee(job, actorType);
    const updated = await this.jobs.transition(jobId, JobStatus.CANCELLED, { type: actorType, id: user.id }, {
      expectedVersion: input.version,
      reason: input.reasonCode,
      data: { reasonText: input.reasonText ?? null, customerFeeMinor: Number(fee.customerFeeMinor), partnerCompensationMinor: Number(fee.partnerCompensationMinor), policyId: fee.policyId },
      requestId,
      patch: {
        cancellationReasonCode: input.reasonCode,
        cancellationReasonText: input.reasonText ?? null,
        cancelledBy: actorType,
        cancellationFeeMinor: fee.customerFeeMinor,
        finalTotalMinor: fee.customerFeeMinor,
        breakdown: (fee.customerFeeMinor > 0n ? [{ code: 'CANCELLATION_FEE', label: { ar: 'رسوم الإلغاء', en: 'Cancellation fee' }, amount: { amount: Number(fee.customerFeeMinor), currency: job.currency } }] : []) as unknown as Prisma.InputJsonValue,
      },
    });
    await this.afterCancellation(updated, actorType, fee, user);
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /** System/admin cancellation (timeouts, dispatcher). */
  async cancelBySystem(jobId: string, actor: TransitionActor, reasonCode: string, reasonText?: string): Promise<void> {
    const job = await this.jobs.getRaw(jobId);
    if (JobStateMachine.isTerminal(job.status)) return;
    if (!JobStateMachine.can(job, JobStatus.CANCELLED, actor.type)) return;
    const updated = await this.jobs.transition(jobId, JobStatus.CANCELLED, actor, { reason: reasonCode, data: { reasonText: reasonText ?? null }, patch: { cancellationReasonCode: reasonCode, cancellationReasonText: reasonText ?? null, cancelledBy: actor.type, finalTotalMinor: 0n } });
    await this.afterCancellation(updated, actor.type, { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: 0, policyId: null }, null);
  }

  private async afterCancellation(job: JobWithRelations, actorType: JobActorType, fee: CancellationFee, user: RequestUser | null): Promise<void> {
    await this.dispatch.cancel(job.id, 'job_cancelled');
    await this.prisma.$transaction(async (tx) => {
      await this.promotions.release(job.id, tx);
      await tx.customerProfile.update({ where: { userId: job.customerId }, data: { cancelledJobs: { increment: actorType === JobActorType.CUSTOMER ? 1 : 0 } } });
      if (job.partnerId) {
        await tx.partnerProfile.update({ where: { userId: job.partnerId }, data: { cancelledJobs: { increment: actorType === JobActorType.PARTNER ? 1 : 0 }, penaltyPoints: { increment: fee.partnerPenaltyPoints } } });
      }
    });
    if (job.partnerId) await this.availability.setBusy(job.partnerId, null);
    if (fee.customerFeeMinor > 0n) {
      try {
        await this.payments.captureForJob(job.id); // charges the cancellation fee and settles partner compensation via ledger
      } catch (err) {
        this.logger.warn({ err, jobId: job.id }, 'cancellation fee capture failed — will be retried by finance queue');
      }
    }
    const reasonVars = { jobNumber: job.number, reason: '' };
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.JOB_CANCELLED, jobId: job.id, vars: reasonVars, priority: 'high' });
    if (job.partnerId && actorType !== JobActorType.PARTNER) await this.notifications.notify({ userId: job.partnerId, event: NotificationEvent.JOB_CANCELLED, jobId: job.id, vars: reasonVars, priority: 'high', collapseKey: `job:${job.id}` });
    this.logger.info({ jobId: job.id, actorType, by: user?.id ?? 'system', fee: fee.customerFeeMinor.toString() }, 'job cancelled');
  }

  private async assertNoShowAllowed(job: JobWithRelations): Promise<void> {
    const waitSeconds = await this.sysConfig.getNumber(CONFIG_KEYS.JOB_WAITING_CUSTOMER_TIMEOUT_S);
    if (!job.partnerArrivedAt || Date.now() - job.partnerArrivedAt.getTime() < waitSeconds * 1000) {
      throw AppException.conflict(`You can report a no-show ${Math.ceil(waitSeconds / 60)} minutes after arriving`, ErrorCode.INVALID_STATE_TRANSITION);
    }
  }

  /* --------------------------------------------------- partner movement */
  async enRoute(jobId: string, user: RequestUser, input: SimpleTransitionInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    const updated = await this.jobs.transition(jobId, JobStatus.PARTNER_EN_ROUTE, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId });
    const eta = await this.tracking.refreshEta(updated);
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.PARTNER_ARRIVING, jobId, vars: { partnerName: job.partner?.user.fullName ?? '', etaMinutes: String(Math.max(1, Math.round((eta ?? 300) / 60))) }, priority: 'high', collapseKey: `job:${jobId}` });
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /** Geofenced arrival (spec §27): within TRACKING_ARRIVAL_GEOFENCE_M of the current stop, or admin override. */
  async arrive(jobId: string, user: RequestUser, input: ArriveJobInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    const stop = job.stops[0];
    if (!stop) throw AppException.internal('Job has no pickup stop');
    const geofence = await this.sysConfig.getNumber(CONFIG_KEYS.TRACKING_ARRIVAL_GEOFENCE_M);
    const distance = haversineMeters({ lat: stop.lat.toNumber(), lng: stop.lng.toNumber() }, input.location);
    if (distance > geofence + Math.min(input.location.accuracy, 100)) {
      throw AppException.conflict(`You are ${Math.round(distance)} m from the pickup point`, ErrorCode.VALIDATION_FAILED, { distanceMeters: Math.round(distance), geofenceMeters: geofence });
    }
    await this.tracking.ingestForPartner(user.partnerId ?? user.id, [input.location], jobId);
    const updated = await this.jobs.transition(jobId, JobStatus.PARTNER_ARRIVED, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, location: input.location, data: { distanceMeters: Math.round(distance) } });
    await this.prisma.jobStop.update({ where: { id: stop.id }, data: { arrivedAt: new Date() } });
    await this.notifications.notify({ userId: updated.customerId, event: NotificationEvent.PARTNER_ARRIVED, jobId, vars: { partnerName: job.partner?.user.fullName ?? '' }, priority: 'high', collapseKey: `job:${jobId}` });
    const waitSeconds = await this.sysConfig.getNumber(CONFIG_KEYS.JOB_WAITING_CUSTOMER_TIMEOUT_S);
    await this.queue.add(JOB_JOBS.WAITING_CUSTOMER_TIMEOUT, { jobId }, { delay: waitSeconds * 1000, jobId: `wait-${jobId}` });
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /** Admin override of arrival (spec §27 "Override موثق"). */
  async adminArrive(jobId: string, actor: RequestUser, reason: string, requestId: string | null): Promise<JobDto> {
    const updated = await this.jobs.transition(jobId, JobStatus.PARTNER_ARRIVED, { type: JobActorType.ADMIN, id: actor.id }, { reason, requestId, eventType: 'partner.arrived_override' });
    await this.notifications.notify({ userId: updated.customerId, event: NotificationEvent.PARTNER_ARRIVED, jobId, vars: { partnerName: updated.partner?.user.fullName ?? '' }, priority: 'high' });
    return this.jobs.toDto(updated, actor);
  }

  /** Start: rides verify the trip PIN, deliveries verify the pickup OTP, services begin inspection. */
  async start(jobId: string, user: RequestUser, input: StartJobInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    const pepper = this.config.env.OTP_PEPPER;
    if (job.type === JobType.RIDE && job.tripPinRequired) {
      if (!input.tripPin || !job.tripPinHash || !safeEqual(job.tripPinHash, hmacHash(input.tripPin, pepper))) throw AppException.badRequest(ErrorCode.TRIP_PIN_INVALID, 'Invalid trip PIN');
    }
    if (job.type === JobType.DELIVERY && job.pickupOtpRequired) {
      if (!input.pickupOtp || !job.pickupOtpHash || !safeEqual(job.pickupOtpHash, hmacHash(input.pickupOtp, pepper))) throw AppException.badRequest(ErrorCode.PICKUP_OTP_INVALID, 'Invalid pickup code');
    }
    const target = job.type === JobType.HOME_SERVICE ? JobStatus.INSPECTION_STARTED : JobStatus.IN_PROGRESS;
    const updated = await this.jobs.transition(jobId, target, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, location: input.location, data: { verified: job.type === JobType.RIDE ? 'trip_pin' : job.type === JobType.DELIVERY ? 'pickup_otp' : null } });
    if (job.type === JobType.DELIVERY) await this.prisma.jobDeliveryDetails.update({ where: { jobId }, data: { pickupVerifiedAt: new Date(), pickupVerifiedMethod: job.pickupOtpRequired ? 'OTP' : 'MANUAL' } });
    const first = job.stops[0];
    if (first && !first.completedAt) await this.prisma.jobStop.update({ where: { id: first.id }, data: { completedAt: new Date() } });
    await this.notifications.notify({ userId: updated.customerId, event: NotificationEvent.JOB_STARTED, jobId, vars: { jobNumber: updated.number }, collapseKey: `job:${jobId}` });
    if (job.type === JobType.HOME_SERVICE) await this.maybeSkipInspection(updated, user);
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /** Categories configured with `workflowConfig.requiresQuote=false` go straight to WORK_STARTED. */
  private async maybeSkipInspection(job: JobWithRelations, user: RequestUser): Promise<void> {
    const wf = (job.category?.workflowConfig as { requiresQuote?: boolean } | null) ?? null;
    if (wf && wf.requiresQuote === false) {
      await this.jobs.transition(job.id, JobStatus.WORK_STARTED, { type: JobActorType.PARTNER, id: user.id }, { eventType: 'work.started', data: { autoFromInspection: true } });
    } else {
      await this.jobs.transition(job.id, JobStatus.QUOTE_REQUIRED, { type: JobActorType.SYSTEM, id: null }, { eventType: 'quote.required' });
    }
  }

  /** Mobility completion (ride/delivery) with proof of delivery + final fare + payment capture. */
  async complete(jobId: string, user: RequestUser, input: CompleteJobInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    if (job.type === JobType.HOME_SERVICE) throw AppException.invalidTransition(job.status, JobStatus.COMPLETED);
    const pepper = this.config.env.OTP_PEPPER;
    let podPatch: Prisma.JobDeliveryDetailsUpdateInput | null = null;
    if (job.type === JobType.DELIVERY) {
      const pod = input.proofOfDelivery;
      if (!pod) throw AppException.validation([{ field: 'proofOfDelivery', message: 'required for deliveries' }]);
      let otpVerified = false;
      if (job.deliveryOtpRequired) {
        if (!pod.deliveryOtp || !job.deliveryOtpHash || !safeEqual(job.deliveryOtpHash, hmacHash(pod.deliveryOtp, pepper))) throw AppException.badRequest(ErrorCode.DELIVERY_OTP_INVALID, 'Invalid delivery code');
        otpVerified = true;
      } else if (!pod.photoMediaId && !pod.receiverName) {
        throw AppException.validation([{ field: 'proofOfDelivery', message: 'photo or receiver name required' }]);
      }
      const mediaIds = [pod.photoMediaId, pod.signatureMediaId].filter((m): m is string => !!m);
      if (mediaIds.length) await this.media.assertOwnedReady(user.id, mediaIds, [MediaPurpose.PROOF_OF_DELIVERY]);
      podPatch = { podReceiverName: pod.receiverName ?? null, podPhoto: pod.photoMediaId ? { connect: { id: pod.photoMediaId } } : undefined, podSignature: pod.signatureMediaId ? { connect: { id: pod.signatureMediaId } } : undefined, podLat: input.location ? new Prisma.Decimal(input.location.lat) : null, podLng: input.location ? new Prisma.Decimal(input.location.lng) : null, podOtpVerified: otpVerified, podTimestamp: new Date() };
    }
    if (input.location) await this.tracking.ingestForPartner(user.partnerId ?? user.id, [input.location], jobId);
    const actuals = await this.tracking.jobActuals(jobId, job.startedAt ?? job.createdAt);
    const waitingSeconds = job.partnerArrivedAt && job.startedAt ? Math.max(0, Math.round((job.startedAt.getTime() - job.partnerArrivedAt.getTime()) / 1000)) : 0;
    const fare = await this.pricing.finalizeFare(job, { distanceMeters: actuals.distanceMeters, durationSeconds: actuals.durationSeconds, waitingSeconds });

    const updated = await this.jobs.transition(jobId, JobStatus.COMPLETED, { type: JobActorType.PARTNER, id: user.id }, {
      expectedVersion: input.version,
      requestId,
      location: input.location,
      data: { actualDistanceMeters: actuals.distanceMeters, actualDurationSeconds: actuals.durationSeconds, finalTotalMinor: Number(fare.totalMinor) },
      patch: { finalTotalMinor: fare.totalMinor, breakdown: fare.breakdown as unknown as Prisma.InputJsonValue, actualDistanceMeters: actuals.distanceMeters, actualDurationSeconds: actuals.durationSeconds },
    });
    if (podPatch) await this.prisma.jobDeliveryDetails.update({ where: { jobId }, data: podPatch });
    const last = job.stops[job.stops.length - 1];
    if (last) await this.prisma.jobStop.update({ where: { id: last.id }, data: { arrivedAt: last.arrivedAt ?? new Date(), completedAt: new Date() } });
    await this.afterCompletion(updated);
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /* --------------------------------------------------- home service flow */
  async startWork(jobId: string, user: RequestUser, input: SimpleTransitionInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    if (job.status === JobStatus.QUOTE_APPROVED) {
      const quote = job.quotes[0];
      if (!quote || quote.status !== 'APPROVED') throw AppException.badRequest(ErrorCode.QUOTE_NOT_APPROVED, 'Work requires an approved quote');
    }
    const updated = await this.jobs.transition(jobId, JobStatus.WORK_STARTED, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, reason: input.note });
    return this.jobs.toDto(updated, user);
  }

  async waitingForParts(jobId: string, user: RequestUser, input: SimpleTransitionInput, requestId: string | null): Promise<JobDto> {
    await this.assertAssignedPartner(jobId, user);
    return this.jobs.toDto(await this.jobs.transition(jobId, JobStatus.WAITING_FOR_PARTS, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, reason: input.note }), user);
  }

  async resumeWork(jobId: string, user: RequestUser, input: SimpleTransitionInput, requestId: string | null): Promise<JobDto> {
    await this.assertAssignedPartner(jobId, user);
    return this.jobs.toDto(await this.jobs.transition(jobId, JobStatus.WORK_STARTED, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, eventType: 'work.resumed' }), user);
  }

  async completeWork(jobId: string, user: RequestUser, input: CompleteJobInput, requestId: string | null): Promise<JobDto> {
    const job = await this.assertAssignedPartner(jobId, user);
    if (job.type !== JobType.HOME_SERVICE) throw AppException.invalidTransition(job.status, JobStatus.WORK_COMPLETED);
    const updated = await this.jobs.transition(jobId, JobStatus.WORK_COMPLETED, { type: JobActorType.PARTNER, id: user.id }, { expectedVersion: input.version, requestId, location: input.location });
    const wf = (job.category?.workflowConfig as { requiresCustomerConfirmation?: boolean; autoConfirmHours?: number } | null) ?? null;
    const hours = wf?.autoConfirmHours ?? (await this.sysConfig.getNumber(CONFIG_KEYS.JOB_AUTO_CONFIRM_HOURS));
    if (wf && wf.requiresCustomerConfirmation === false) {
      await this.confirmWorkInternal(jobId, { type: JobActorType.SYSTEM, id: null }, 'auto_no_confirmation_required');
    } else {
      await this.notifications.notify({ userId: updated.customerId, event: NotificationEvent.JOB_COMPLETED, jobId, vars: { jobNumber: updated.number, total: '' }, priority: 'high' });
      await this.queue.add(JOB_JOBS.AUTO_CONFIRM_WORK, { jobId }, { delay: hours * 3600 * 1000, jobId: `autoconfirm-${jobId}` });
    }
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  async confirmWork(jobId: string, user: RequestUser, input: SimpleTransitionInput, requestId: string | null): Promise<JobDto> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isCustomer(user, job)) throw AppException.forbidden();
    await this.confirmWorkInternal(jobId, { type: JobActorType.CUSTOMER, id: user.id }, input.note, input.version, requestId);
    return this.jobs.toDto(await this.jobs.getRaw(jobId), user);
  }

  /** WORK_COMPLETED → CUSTOMER_CONFIRMED → COMPLETED with the approved quote as the final fare. */
  async confirmWorkInternal(jobId: string, actor: TransitionActor, note?: string, expectedVersion?: number, requestId: string | null = null): Promise<void> {
    const confirmed = await this.jobs.transition(jobId, JobStatus.CUSTOMER_CONFIRMED, actor, { expectedVersion, requestId, reason: note });
    const quote = confirmed.quotes[0];
    const approvedQuote = quote && quote.status === 'APPROVED' ? { laborMinor: quote.laborCostMinor, partsMinor: quote.partsCostMinor, feesMinor: quote.additionalFeesMinor, discountMinor: quote.discountMinor } : null;
    const optionsMinor = confirmed.serviceOptions.reduce((s, o) => s + o.priceMinor, 0n);
    const hours = confirmed.startedAt ? Math.max(1, Math.ceil((Date.now() - confirmed.startedAt.getTime()) / 3_600_000)) : 1;
    const fare = await this.pricing.finalizeFare(confirmed, { quote: approvedQuote, optionsMinor, hours });
    const completed = await this.jobs.transition(jobId, JobStatus.COMPLETED, { type: JobActorType.SYSTEM, id: null }, { data: { finalTotalMinor: Number(fare.totalMinor) }, patch: { finalTotalMinor: fare.totalMinor, breakdown: fare.breakdown as unknown as Prisma.InputJsonValue } });
    await this.afterCompletion(completed);
  }

  /** Shared post-completion side effects (spec §29): counters, availability, payment capture (→ ledger, receipt, notifications). */
  private async afterCompletion(job: JobWithRelations): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.customerProfile.update({ where: { userId: job.customerId }, data: { completedJobs: { increment: 1 } } });
      if (job.partnerId) await tx.partnerProfile.update({ where: { userId: job.partnerId }, data: { completedJobs: { increment: 1 } } });
    });
    if (job.partnerId) await this.availability.setBusy(job.partnerId, null);
    try {
      await this.payments.captureForJob(job.id);
    } catch (err) {
      // Payment failure is surfaced to the customer by PaymentsService; the job stays COMPLETED with an unpaid payment.
      this.logger.warn({ err, jobId: job.id }, 'payment capture failed after completion');
    }
  }

  /* ------------------------------------------------------------ admin */
  async adminTransition(jobId: string, actor: RequestUser, to: JobStatus, reason: string, expectedVersion: number, requestId: string | null): Promise<JobDto> {
    if (to === JobStatus.CANCELLED) {
      const job = await this.jobs.getRaw(jobId);
      const fee = { customerFeeMinor: 0n, partnerCompensationMinor: 0n, partnerPenaltyPoints: 0, policyId: null };
      const updated = await this.jobs.transition(jobId, JobStatus.CANCELLED, { type: JobActorType.ADMIN, id: actor.id }, { expectedVersion, reason, requestId, patch: { cancellationReasonCode: 'ADMIN', cancellationReasonText: reason, cancelledBy: JobActorType.ADMIN, finalTotalMinor: 0n } });
      await this.afterCancellation(updated, JobActorType.ADMIN, fee, actor);
      this.logger.info({ jobId, admin: actor.id, previous: job.status }, 'admin cancelled job');
      return this.jobs.toDto(await this.jobs.getRaw(jobId), actor);
    }
    if (to === JobStatus.PARTNER_ARRIVED) return this.adminArrive(jobId, actor, reason, requestId);
    const updated = await this.jobs.transition(jobId, to, { type: JobActorType.ADMIN, id: actor.id }, { expectedVersion, reason, requestId });
    return this.jobs.toDto(updated, actor);
  }

  /* --------------------------------------------------------- scheduler */
  async onWaitingCustomerTimeout(jobId: string): Promise<void> {
    const job = await this.jobs.getRaw(jobId);
    if (job.status !== JobStatus.PARTNER_ARRIVED) return;
    await this.jobs.transition(jobId, JobStatus.WAITING_CUSTOMER, { type: JobActorType.SYSTEM, id: null }, { eventType: 'partner.waiting' });
    if (job.partnerId) await this.notifications.notify({ userId: job.partnerId, event: NotificationEvent.PARTNER_ARRIVED, jobId, vars: { partnerName: '' }, data: { hint: 'no_show_allowed' }, collapseKey: `job:${jobId}` });
  }

  async onAutoConfirmWork(jobId: string): Promise<void> {
    const job = await this.jobs.getRaw(jobId);
    if (job.status !== JobStatus.WORK_COMPLETED) return;
    await this.confirmWorkInternal(jobId, { type: JobActorType.SYSTEM, id: null }, 'auto_confirmed_after_window');
  }

  /* ----------------------------------------------------------- helpers */
  private async assertAssignedPartner(jobId: string, user: RequestUser): Promise<JobWithRelations> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isAssignedPartner(user, job)) throw AppException.forbidden('You are not assigned to this job');
    return job;
  }
}
