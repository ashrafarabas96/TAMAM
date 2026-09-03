import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { AssignmentStatus, CONFIG_KEYS, ErrorCode, JobActorType, type JobOfferDto, JobStatus, JobType, type LiveMapPartnerDto, NotificationEvent, type PartnerRoleType } from '@tamam/shared-types';
import type { NearbyPartnersQueryInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { estimateEtaSeconds } from '../../common/utils/geo';
import { formatMajor } from '../../common/utils/money';
import { addSeconds } from '../../common/utils/time';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MAPS_PROVIDER, type MapsProvider } from '../../infrastructure/providers/maps/maps.provider';
import { DISPATCH_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';
import { LockBusyError, LockService } from '../../infrastructure/redis/lock.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';
import { JobMapper } from '../jobs/job.mapper';
import { JobsService } from '../jobs/jobs.service';
import { type JobWithRelations, jobInclude } from '../jobs/jobs.types';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerAvailabilityService } from '../partners/partner-availability.service';
import { PricingService } from '../pricing/pricing.service';
import { type CandidateInput, scoreCandidates } from './domain/candidate-scoring';

interface CandidateRow {
  partner_id: string;
  distance_m: number;
  lat: number;
  lng: number;
  rating_sum: number;
  rating_count: number;
  offers_received: number;
  offers_accepted: number;
  completed_jobs: number;
  cancelled_jobs: number;
  penalty_points: number;
  recent_jobs: number;
  active_vehicle_id: string | null;
}

export const DispatchEvents = {
  OFFER: 'dispatch.offer', // { partnerId, offer: JobOfferDto }
  OFFER_EXPIRED: 'dispatch.offer_expired', // { partnerId, jobId, assignmentId }
} as const;

/**
 * Dispatch engine (spec §19–§22): waves of scored candidates, offer TTLs, total timeout,
 * atomic accept guarded by (1) Redis lock, (2) SELECT … FOR UPDATE on the job,
 * (3) the DB partial unique index `uq_job_assignments_one_accepted`.
 */
@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
    private readonly lock: LockService,
    private readonly notifications: NotificationsService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
    private readonly mapper: JobMapper,
    private readonly events: EventEmitter2,
    private readonly logger: Logger,
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService,
    @Inject(forwardRef(() => PricingService)) private readonly pricing: PricingService,
    @Inject(forwardRef(() => PartnerAvailabilityService)) private readonly availability: PartnerAvailabilityService,
    @Inject(MAPS_PROVIDER) private readonly maps: MapsProvider,
    @InjectQueue(QUEUES.DISPATCH) private readonly queue: Queue,
  ) {}

  /* ------------------------------------------------------------ start */
  async start(jobId: string): Promise<void> {
    await this.queue.add(DISPATCH_JOBS.WAVE, { jobId, wave: 1 }, { jobId: `wave-${jobId}-1-${Date.now()}` });
  }

  /** Worker entry for each wave. Idempotent: re-running a wave never double-offers a partner. */
  async runWave(jobId: string, wave: number): Promise<void> {
    let job = await this.jobs.getRaw(jobId);
    if (job.status === JobStatus.REQUESTED || job.status === JobStatus.NO_PARTNER_AVAILABLE) {
      const timeout = await this.config.getNumber(CONFIG_KEYS.DISPATCH_TOTAL_TIMEOUT_S);
      job = await this.jobs.transition(jobId, JobStatus.SEARCHING, { type: JobActorType.SYSTEM, id: null }, { patch: { dispatchStartedAt: new Date(), dispatchDeadlineAt: addSeconds(new Date(), timeout), dispatchWave: 0 } });
      await this.queue.add(DISPATCH_JOBS.DISPATCH_TIMEOUT, { jobId }, { delay: timeout * 1000, jobId: `timeout-${jobId}-${job.version}` });
    }
    if (job.status !== JobStatus.SEARCHING) return;
    if (job.dispatchDeadlineAt && job.dispatchDeadlineAt < new Date()) {
      await this.onTimeout(jobId);
      return;
    }
    const [maxWaves, offerTtl] = await Promise.all([this.config.getNumber(CONFIG_KEYS.DISPATCH_MAX_WAVES), this.config.getNumber(CONFIG_KEYS.DISPATCH_OFFER_TTL_S)]);
    if (wave > maxWaves) {
      await this.onTimeout(jobId);
      return;
    }
    const { radius, size } = await this.waveParams(wave);
    const candidates = await this.findCandidates(job, radius, size * 3);
    const scored = await this.score(job, candidates, radius);
    const chosen = scored.slice(0, size);
    await this.jobs.patch(jobId, { dispatchWave: wave });

    if (!chosen.length) {
      this.logger.info({ jobId, wave, radius }, 'dispatch wave found no candidates');
      await this.scheduleNextWave(jobId, wave, maxWaves, Math.min(offerTtl, 10));
      return;
    }

    const expiresAt = addSeconds(new Date(), offerTtl);
    const earnings = await this.pricing.estimatedPartnerEarnings(job.estimatedTotalMinor ?? 0n, job.pricingSnapshot ? { commissionPercent: job.pricingSnapshot.commissionPercent, commissionFixedMinor: job.pricingSnapshot.commissionFixedMinor } : null, job.promoDiscountMinor);
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const c of chosen) {
        try {
          const a = await tx.jobAssignment.create({ data: { jobId, partnerId: c.partnerId, wave, status: AssignmentStatus.OFFERED, score: new Prisma.Decimal(c.score), distanceMeters: Math.round(c.distanceMeters), etaSeconds: c.etaSeconds, estimatedEarningsMinor: earnings, expiresAt } });
          rows.push(a);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue; // already offered
          throw err;
        }
      }
      if (rows.length) await tx.partnerProfile.updateMany({ where: { userId: { in: rows.map((r) => r.partnerId) } }, data: { offersReceived: { increment: 1 } } });
      return rows;
    });

    const jobDto = this.mapper.toDto(job, { kind: 'share-link' });
    for (const a of created) {
      const offer: JobOfferDto = { assignmentId: a.id, job: { ...jobDto, customer: undefined }, wave, expiresAt: expiresAt.toISOString(), distanceToPickupMeters: a.distanceMeters, etaToPickupSeconds: a.etaSeconds, estimatedEarnings: { amount: Number(earnings), currency: job.currency as JobOfferDto['estimatedEarnings']['currency'] } };
      this.events.emit(DispatchEvents.OFFER, { partnerId: a.partnerId, offer });
      await this.notifications.notify({ userId: a.partnerId, event: NotificationEvent.JOB_OFFER, jobId, priority: 'high', collapseKey: `offer:${jobId}`, vars: { serviceName: this.serviceName(job), distanceKm: (a.distanceMeters / 1000).toFixed(1), earnings: formatMajor(earnings, job.currency) }, data: { assignmentId: a.id, expiresAt: expiresAt.toISOString(), type: 'JOB_OFFER' } });
    }
    await this.queue.add(DISPATCH_JOBS.OFFER_EXPIRED, { jobId, wave }, { delay: offerTtl * 1000 + 500, jobId: `expire-${jobId}-${wave}-${Date.now()}` });
    this.logger.info({ jobId, wave, offered: created.length, radius }, 'dispatch wave sent');
  }

  private async scheduleNextWave(jobId: string, wave: number, maxWaves: number, delaySeconds: number): Promise<void> {
    if (wave >= maxWaves) {
      await this.onTimeout(jobId);
      return;
    }
    await this.queue.add(DISPATCH_JOBS.WAVE, { jobId, wave: wave + 1 }, { delay: delaySeconds * 1000, jobId: `wave-${jobId}-${wave + 1}-${Date.now()}` });
  }

  /** Worker: expire a wave's open offers, then continue or give up. */
  async onOffersExpired(jobId: string, wave: number): Promise<void> {
    const expired = await this.prisma.jobAssignment.findMany({ where: { jobId, wave, status: AssignmentStatus.OFFERED } });
    if (expired.length) {
      await this.prisma.jobAssignment.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { status: AssignmentStatus.EXPIRED, releasedAt: new Date(), releaseReason: 'offer_ttl' } });
      for (const e of expired) this.events.emit(DispatchEvents.OFFER_EXPIRED, { partnerId: e.partnerId, jobId, assignmentId: e.id });
    }
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true, dispatchDeadlineAt: true } });
    if (!job || job.status !== JobStatus.SEARCHING) return;
    if (job.dispatchDeadlineAt && job.dispatchDeadlineAt < new Date()) {
      await this.onTimeout(jobId);
      return;
    }
    const maxWaves = await this.config.getNumber(CONFIG_KEYS.DISPATCH_MAX_WAVES);
    await this.scheduleNextWave(jobId, wave, maxWaves, 0);
  }

  /** Worker: total dispatch timeout → NO_PARTNER_AVAILABLE. */
  async onTimeout(jobId: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true, customerId: true, number: true, type: true, createdAt: true } });
    if (!job || job.status !== JobStatus.SEARCHING) return;
    await this.cancelOpenOffers(jobId, 'dispatch_timeout');
    await this.jobs.transition(jobId, JobStatus.NO_PARTNER_AVAILABLE, { type: JobActorType.SYSTEM, id: null });
    this.metrics.dispatchOutcome.inc({ outcome: 'no_partner' });
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.NO_PARTNER_AVAILABLE, jobId, vars: { jobNumber: job.number }, priority: 'high' });
  }

  /** Customer retry after NO_PARTNER_AVAILABLE (spec §18 transition). */
  async retry(jobId: string, user: RequestUser): Promise<void> {
    const job = await this.jobs.getForUser(jobId, user);
    if (job.status !== JobStatus.NO_PARTNER_AVAILABLE) throw AppException.invalidTransition(job.status, JobStatus.SEARCHING);
    await this.prisma.jobAssignment.updateMany({ where: { jobId, status: { in: [AssignmentStatus.EXPIRED, AssignmentStatus.REJECTED] } }, data: { releaseReason: 'retry_reset' } });
    // Allow previously offered partners to be considered again on retry.
    await this.prisma.jobAssignment.deleteMany({ where: { jobId, status: { in: [AssignmentStatus.EXPIRED, AssignmentStatus.REJECTED, AssignmentStatus.CANCELLED] } } });
    await this.runWave(jobId, 1);
  }

  async cancel(jobId: string, reason: string): Promise<void> {
    await this.cancelOpenOffers(jobId, reason);
    const jobs = await this.queue.getJobs(['delayed', 'waiting']);
    for (const q of jobs) {
      if ((q.data as { jobId?: string }).jobId === jobId) await q.remove().catch(() => undefined);
    }
  }

  private async cancelOpenOffers(jobId: string, reason: string): Promise<void> {
    const open = await this.prisma.jobAssignment.findMany({ where: { jobId, status: AssignmentStatus.OFFERED } });
    if (!open.length) return;
    await this.prisma.jobAssignment.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: AssignmentStatus.CANCELLED, releasedAt: new Date(), releaseReason: reason } });
    for (const o of open) this.events.emit(DispatchEvents.OFFER_EXPIRED, { partnerId: o.partnerId, jobId, assignmentId: o.id });
  }

  /* ---------------------------------------------------------- offers */
  async listOffers(user: RequestUser): Promise<JobOfferDto[]> {
    const partnerId = this.partnerIdOf(user);
    const rows = await this.prisma.jobAssignment.findMany({ where: { partnerId, status: AssignmentStatus.OFFERED, expiresAt: { gt: new Date() } }, include: { job: { include: jobInclude } }, orderBy: { offeredAt: 'desc' } });
    return rows.filter((r) => r.job.status === JobStatus.SEARCHING).map((r) => ({ assignmentId: r.id, job: { ...this.mapper.toDto(r.job, { kind: 'share-link' }), customer: undefined }, wave: r.wave, expiresAt: r.expiresAt.toISOString(), distanceToPickupMeters: r.distanceMeters, etaToPickupSeconds: r.etaSeconds, estimatedEarnings: { amount: Number(r.estimatedEarningsMinor), currency: r.job.currency as JobOfferDto['estimatedEarnings']['currency'] } }));
  }

  /** Accept/reject an offer. Accept is race-safe (spec §22, §128). */
  async respond(user: RequestUser, assignmentId: string, accept: boolean, location?: { lat: number; lng: number; accuracy: number; timestamp: string }): Promise<JobWithRelations | null> {
    const partnerId = this.partnerIdOf(user);
    const assignment = await this.prisma.jobAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.partnerId !== partnerId) throw AppException.notFound('Offer', assignmentId);
    if (assignment.status !== AssignmentStatus.OFFERED) throw AppException.conflict('This offer is no longer available', ErrorCode.OFFER_EXPIRED);
    if (assignment.expiresAt < new Date()) throw AppException.conflict('This offer has expired', ErrorCode.OFFER_EXPIRED);

    if (!accept) {
      await this.prisma.jobAssignment.updateMany({ where: { id: assignmentId, status: AssignmentStatus.OFFERED }, data: { status: AssignmentStatus.REJECTED, respondedAt: new Date() } });
      return null;
    }

    if (!(await this.availability.isEffectivelyOnline(partnerId))) throw AppException.badRequest(ErrorCode.PARTNER_NOT_AVAILABLE, 'Go online to accept jobs');

    let result: { updated: JobWithRelations; emit: () => void; losers: string[] };
    try {
      result = await this.lock.withLock(`job:${assignment.jobId}`, 5000, () =>
        this.prisma.$transaction(async (tx) => {
          const claimed = await tx.jobAssignment.updateMany({ where: { id: assignmentId, status: AssignmentStatus.OFFERED, expiresAt: { gt: new Date() } }, data: { status: AssignmentStatus.ACCEPTED, respondedAt: new Date() } });
          if (claimed.count === 0) throw AppException.conflict('This offer is no longer available', ErrorCode.OFFER_EXPIRED);
          const partner = await tx.partnerProfile.findUniqueOrThrow({ where: { userId: partnerId }, include: { availability: true } });
          if (partner.availability?.currentJobId) throw AppException.conflict('You already have an active job', ErrorCode.JOB_ALREADY_ASSIGNED);
          const t = await this.jobs.transitionInTx(tx, assignment.jobId, JobStatus.ASSIGNED, { type: JobActorType.SYSTEM, id: partnerId }, {
            data: { assignmentId, wave: assignment.wave, score: assignment.score.toNumber() },
            patch: { partner: { connect: { userId: partnerId } }, ...(partner.activeVehicleId ? { vehicle: { connect: { id: partner.activeVehicleId } } } : {}), etaToPickupSeconds: assignment.etaSeconds },
          });
          const others = await tx.jobAssignment.findMany({ where: { jobId: assignment.jobId, status: AssignmentStatus.OFFERED } });
          await tx.jobAssignment.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: AssignmentStatus.CANCELLED, releasedAt: new Date(), releaseReason: 'taken' } });
          await tx.partnerProfile.update({ where: { userId: partnerId }, data: { offersAccepted: { increment: 1 } } });
          await tx.partnerAvailability.update({ where: { partnerId }, data: { status: 'BUSY', currentJobId: assignment.jobId } });
          return { updated: t.updated, emit: t.emit, losers: others.map((o) => o.partnerId) };
        }),
      );
    } catch (err) {
      if (err instanceof LockBusyError) throw AppException.conflict('Another partner is accepting this job', ErrorCode.JOB_ALREADY_ASSIGNED);
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw AppException.conflict('Job was already taken', ErrorCode.JOB_ALREADY_ASSIGNED);
      if (err instanceof AppException && err.code === ErrorCode.INVALID_STATE_TRANSITION) throw AppException.conflict('Job was already taken', ErrorCode.JOB_ALREADY_ASSIGNED);
      throw err;
    }
    result.emit();
    await this.cancel(assignment.jobId, 'assigned');
    for (const loser of result.losers) this.events.emit(DispatchEvents.OFFER_EXPIRED, { partnerId: loser, jobId: assignment.jobId, assignmentId: null });

    const job = result.updated;
    this.metrics.dispatchOutcome.inc({ outcome: 'assigned' });
    if (job.dispatchStartedAt) this.metrics.dispatchSeconds.observe({ type: job.type }, (Date.now() - job.dispatchStartedAt.getTime()) / 1000);
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.JOB_ACCEPTED, jobId: job.id, priority: 'high', collapseKey: `job:${job.id}`, vars: { partnerName: job.partner?.user.fullName ?? '', etaMinutes: String(Math.max(1, Math.round((assignment.etaSeconds || 300) / 60))) } });
    if (location) await this.availability.heartbeat(partnerId, { location: { lat: location.lat, lng: location.lng, accuracy: location.accuracy, timestamp: location.timestamp } }).catch((err: unknown) => this.logger.warn({ err }, 'heartbeat after accept failed'));
    return job;
  }

  /** Partner backs out after accepting (before start): job goes back to SEARCHING, partner penalised. */
  async releaseByPartner(jobId: string, user: RequestUser, reason: string): Promise<void> {
    const partnerId = this.partnerIdOf(user);
    const job = await this.jobs.getForUser(jobId, user);
    if (job.partnerId !== partnerId) throw AppException.forbidden();
    const penalty = await this.config.getNumber(CONFIG_KEYS.CANCELLATION_PARTNER_PENALTY_POINTS);
    await this.jobs.transition(jobId, JobStatus.SEARCHING, { type: JobActorType.PARTNER, id: user.id }, { reason, patch: { dispatchWave: 0 } });
    await this.prisma.$transaction([
      this.prisma.jobAssignment.updateMany({ where: { jobId, partnerId, status: AssignmentStatus.ACCEPTED }, data: { status: AssignmentStatus.REASSIGNED, releasedAt: new Date(), releaseReason: reason } }),
      this.prisma.partnerProfile.update({ where: { userId: partnerId }, data: { cancelledJobs: { increment: 1 }, penaltyPoints: { increment: penalty } } }),
    ]);
    await this.availability.setBusy(partnerId, null);
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.JOB_CREATED, jobId, vars: { jobNumber: job.number }, data: { hint: 'partner_released' } });
    await this.runWave(jobId, 1);
  }

  /* ------------------------------------------------------- dispatcher */
  async manualAssign(jobId: string, partnerId: string, actor: RequestUser, reason: string, expectedVersion: number, requestId: string | null): Promise<JobWithRelations> {
    const job = await this.jobs.getRaw(jobId);
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, include: { availability: true, roles: true } });
    if (!partner || partner.verificationStatus !== 'APPROVED') throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, 'Partner is not approved');
    if (partner.availability?.currentJobId && partner.availability.currentJobId !== jobId) throw AppException.conflict('Partner is busy on another job', ErrorCode.PARTNER_NOT_AVAILABLE);
    const requiredRole = this.roleFor(job);
    if (!partner.roles.some((r) => r.isActive && r.role === requiredRole)) throw AppException.badRequest(ErrorCode.PARTNER_NOT_AVAILABLE, `Partner lacks the ${requiredRole} role`);

    if (job.status === JobStatus.ASSIGNED || job.status === JobStatus.PARTNER_EN_ROUTE || job.status === JobStatus.PARTNER_ARRIVED || job.status === JobStatus.WAITING_CUSTOMER) {
      const previous = job.partnerId;
      await this.jobs.transition(jobId, JobStatus.SEARCHING, { type: JobActorType.ADMIN, id: actor.id }, { reason, requestId, eventType: 'partner.unassigned', expectedVersion });
      if (previous) {
        await this.prisma.jobAssignment.updateMany({ where: { jobId, partnerId: previous, status: AssignmentStatus.ACCEPTED }, data: { status: AssignmentStatus.REASSIGNED, releasedAt: new Date(), releaseReason: 'dispatcher_reassign' } });
        await this.availability.setBusy(previous, null);
        await this.notifications.notify({ userId: previous, event: NotificationEvent.JOB_CANCELLED, jobId, vars: { jobNumber: job.number, reason: '' }, priority: 'high' });
      }
    } else if (job.status === JobStatus.REQUESTED || job.status === JobStatus.NO_PARTNER_AVAILABLE) {
      await this.jobs.transition(jobId, JobStatus.SEARCHING, { type: JobActorType.ADMIN, id: actor.id }, { reason, requestId });
    } else if (job.status !== JobStatus.SEARCHING) {
      throw AppException.invalidTransition(job.status, JobStatus.ASSIGNED);
    }
    await this.cancel(jobId, 'manual_assign');

    const pickup = job.stops[0];
    const loc = partner.availability;
    const distance = pickup && loc?.lat && loc.lng ? this.pricing.distanceMeters({ lat: pickup.lat.toNumber(), lng: pickup.lng.toNumber() }, { lat: loc.lat.toNumber(), lng: loc.lng.toNumber() }) : 0;
    const earnings = await this.pricing.estimatedPartnerEarnings(job.estimatedTotalMinor ?? 0n, job.pricingSnapshot ? { commissionPercent: job.pricingSnapshot.commissionPercent, commissionFixedMinor: job.pricingSnapshot.commissionFixedMinor } : null, job.promoDiscountMinor);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.jobAssignment.create({ data: { jobId, partnerId, wave: 0, status: AssignmentStatus.ACCEPTED, score: new Prisma.Decimal(1), distanceMeters: Math.round(distance), etaSeconds: estimateEtaSeconds(distance * 1.3), estimatedEarningsMinor: earnings, isManual: true, assignedById: actor.id, respondedAt: new Date(), expiresAt: new Date() } });
      const t = await this.jobs.transitionInTx(tx, jobId, JobStatus.ASSIGNED, { type: JobActorType.ADMIN, id: actor.id }, { reason, requestId, eventType: 'partner.assigned_manually', patch: { partner: { connect: { userId: partnerId } }, ...(partner.activeVehicleId ? { vehicle: { connect: { id: partner.activeVehicleId } } } : {}), etaToPickupSeconds: estimateEtaSeconds(distance * 1.3) } });
      await tx.partnerAvailability.upsert({ where: { partnerId }, update: { status: 'BUSY', currentJobId: jobId }, create: { partnerId, status: 'BUSY', currentJobId: jobId } });
      await this.audit.record({ actorId: actor.id, action: 'dispatch.manual_assign', entity: 'job', entityId: jobId, newValue: { partnerId, previousPartnerId: job.partnerId }, reason, requestId }, tx);
      return t;
    });
    result.emit();
    this.metrics.dispatchOutcome.inc({ outcome: 'manual' });
    await this.notifications.notify({ userId: partnerId, event: NotificationEvent.JOB_ACCEPTED, jobId, priority: 'high', vars: { partnerName: '', etaMinutes: '' }, data: { hint: 'manual_assignment' } });
    await this.notifications.notify({ userId: job.customerId, event: NotificationEvent.JOB_ACCEPTED, jobId, priority: 'high', vars: { partnerName: result.updated.partner?.user.fullName ?? '', etaMinutes: String(Math.max(1, Math.round(estimateEtaSeconds(distance * 1.3) / 60))) } });
    return result.updated;
  }

  async nearbyPartners(q: NearbyPartnersQueryInput): Promise<Array<LiveMapPartnerDto & { distanceMeters: number; rating: number; completedJobs: number; fullName: string | null; phone: string }>> {
    const rows = await this.prisma.$queryRaw<Array<CandidateRow & { status: string; heading: number | null; last_heartbeat_at: Date; full_name: string | null; phone: string; roles: PartnerRoleType[]; current_job_id: string | null }>>`
      SELECT pa.partner_id, ST_Distance(pa.location, ST_SetSRID(ST_MakePoint(${q.lng}::double precision, ${q.lat}::double precision), 4326)::geography) AS distance_m,
             pa.lat::float8 AS lat, pa.lng::float8 AS lng, pa.status::text AS status, pa.heading::float8 AS heading, pa.last_heartbeat_at, pa.current_job_id,
             pp.rating_sum, pp.rating_count, pp.offers_received, pp.offers_accepted, pp.completed_jobs, pp.cancelled_jobs, pp.penalty_points, pp.active_vehicle_id, 0::int AS recent_jobs,
             u.full_name, u.phone, ARRAY(SELECT role::text FROM partner_roles WHERE partner_id = pa.partner_id AND is_active) AS roles
      FROM partner_availability pa
      JOIN partner_profiles pp ON pp.user_id = pa.partner_id AND pp.verification_status = 'APPROVED'
      JOIN users u ON u.id = pa.partner_id
      WHERE pa.status IN ('ONLINE','BUSY') AND pa.location IS NOT NULL AND pa.last_heartbeat_at > now() - interval '5 minutes'
        ${q.role ? Prisma.sql`AND EXISTS (SELECT 1 FROM partner_roles pr WHERE pr.partner_id = pa.partner_id AND pr.is_active AND pr.role = ${q.role}::partner_role_type)` : Prisma.empty}
        AND ST_DWithin(pa.location, ST_SetSRID(ST_MakePoint(${q.lng}::double precision, ${q.lat}::double precision), 4326)::geography, ${q.radiusMeters})
      ORDER BY distance_m ASC LIMIT ${q.limit}`;
    return rows.map((r) => ({ partnerId: r.partner_id, availability: r.status as LiveMapPartnerDto['availability'], roles: r.roles, location: { lat: r.lat, lng: r.lng }, heading: r.heading, activeJobId: r.current_job_id, lastSeenAt: r.last_heartbeat_at.toISOString(), distanceMeters: Math.round(r.distance_m), rating: r.rating_count ? Number((r.rating_sum / r.rating_count).toFixed(2)) : 5, completedJobs: r.completed_jobs, fullName: r.full_name, phone: r.phone }));
  }

  async assignmentsForJob(jobId: string) {
    return this.prisma.jobAssignment.findMany({ where: { jobId }, include: { partner: { include: { user: { select: { fullName: true, phone: true } } } } }, orderBy: [{ wave: 'asc' }, { score: 'desc' }] });
  }

  /* --------------------------------------------------------- internals */
  private async waveParams(wave: number): Promise<{ radius: number; size: number }> {
    const keys = wave === 1 ? [CONFIG_KEYS.DISPATCH_WAVE_1_RADIUS_M, CONFIG_KEYS.DISPATCH_WAVE_1_SIZE] : wave === 2 ? [CONFIG_KEYS.DISPATCH_WAVE_2_RADIUS_M, CONFIG_KEYS.DISPATCH_WAVE_2_SIZE] : [CONFIG_KEYS.DISPATCH_WAVE_3_RADIUS_M, CONFIG_KEYS.DISPATCH_WAVE_3_SIZE];
    const [radiusKey, sizeKey] = keys as [typeof CONFIG_KEYS.DISPATCH_WAVE_1_RADIUS_M, typeof CONFIG_KEYS.DISPATCH_WAVE_1_SIZE];
    const [radius, size] = await Promise.all([this.config.getNumber(radiusKey), this.config.getNumber(sizeKey)]);
    // Waves beyond 3 keep expanding the radius by 50 % each.
    const factor = wave > 3 ? 1.5 ** (wave - 3) : 1;
    return { radius: Math.round(radius * factor), size };
  }

  /** PostGIS candidate query implementing every eligibility rule of spec §19. */
  private async findCandidates(job: JobWithRelations, radiusMeters: number, limit: number): Promise<CandidateRow[]> {
    const pickup = job.stops[0];
    if (!pickup) return [];
    const lat = pickup.lat.toNumber();
    const lng = pickup.lng.toNumber();
    const role = this.roleFor(job);
    const [heartbeatMax, maxNegative] = await Promise.all([this.config.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S), this.config.getNumber(CONFIG_KEYS.WALLET_MAX_NEGATIVE_PARTNER_MINOR)]);
    const needsVehicle = job.type === JobType.RIDE || job.type === JobType.DELIVERY;
    return this.prisma.$queryRaw<CandidateRow[]>`
      SELECT pa.partner_id,
             ST_Distance(pa.location, ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography) AS distance_m,
             pa.lat::float8 AS lat, pa.lng::float8 AS lng,
             pp.rating_sum, pp.rating_count, pp.offers_received, pp.offers_accepted, pp.completed_jobs, pp.cancelled_jobs, pp.penalty_points, pp.active_vehicle_id,
             (SELECT count(*)::int FROM jobs j2 WHERE j2.partner_id = pa.partner_id AND j2.completed_at > now() - interval '1 hour') AS recent_jobs
      FROM partner_availability pa
      JOIN partner_profiles pp ON pp.user_id = pa.partner_id AND pp.verification_status = 'APPROVED' AND (pp.suspended_until IS NULL OR pp.suspended_until < now())
      JOIN users u ON u.id = pa.partner_id AND u.account_status = 'ACTIVE'
      JOIN partner_roles pr ON pr.partner_id = pa.partner_id AND pr.is_active AND pr.role = ${role}::partner_role_type
      JOIN partner_zones pz ON pz.partner_id = pa.partner_id AND pz.zone_id = ${job.zoneId}::uuid
      LEFT JOIN vehicles v ON v.id = pp.active_vehicle_id
      LEFT JOIN wallets w ON w.partner_id = pa.partner_id
      ${job.type === JobType.HOME_SERVICE && job.categoryId ? Prisma.sql`JOIN partner_categories pc ON pc.partner_id = pa.partner_id AND pc.category_id = ${job.categoryId}::uuid` : Prisma.empty}
      WHERE pa.status = 'ONLINE' AND pa.current_job_id IS NULL AND pa.location IS NOT NULL
        AND pa.last_heartbeat_at > now() - (${heartbeatMax}::int * interval '1 second')
        AND ${role}::text = ANY(SELECT unnest(pa.active_roles)::text)
        ${needsVehicle ? Prisma.sql`AND v.id IS NOT NULL AND v.is_active AND v.verification_status = 'APPROVED' AND v.vehicle_type_id = ${job.vehicleTypeId}::uuid` : Prisma.empty}
        ${job.paymentMethod === 'CASH' ? Prisma.sql`AND COALESCE(w.balance_minor, 0) > -(${maxNegative}::bigint)` : Prisma.empty}
        AND NOT EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.job_id = ${job.id}::uuid AND ja.partner_id = pa.partner_id)
        AND NOT EXISTS (SELECT 1 FROM restrictions r WHERE r.lifted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > now()) AND r.kind = 'BLOCK_JOBS' AND r.target_type IN ('USER','PARTNER') AND r.target_id = pa.partner_id::text)
        AND ST_DWithin(pa.location, ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography, ${radiusMeters})
      ORDER BY distance_m ASC
      LIMIT ${limit}`;
  }

  private async score(job: JobWithRelations, rows: CandidateRow[], radius: number) {
    if (!rows.length) return [];
    const pickup = job.stops[0];
    const weights = await this.config.getMany([CONFIG_KEYS.DISPATCH_SCORE_W_ETA, CONFIG_KEYS.DISPATCH_SCORE_W_DISTANCE, CONFIG_KEYS.DISPATCH_SCORE_W_RATING, CONFIG_KEYS.DISPATCH_SCORE_W_ACCEPTANCE, CONFIG_KEYS.DISPATCH_SCORE_W_CANCELLATION, CONFIG_KEYS.DISPATCH_SCORE_W_WORKLOAD]);
    let etas: Array<number | null> = rows.map((r) => estimateEtaSeconds(Number(r.distance_m) * 1.3));
    if (pickup && rows.length <= 25) {
      try {
        const matrix = await this.maps.distanceMatrix(rows.map((r) => ({ lat: r.lat, lng: r.lng })), [{ lat: pickup.lat.toNumber(), lng: pickup.lng.toNumber() }]);
        etas = rows.map((_, i) => matrix.rows[i]?.[0]?.durationSeconds ?? etas[i] ?? null);
      } catch (err) {
        this.logger.warn({ err }, 'distance matrix failed; using haversine ETA');
      }
    }
    const inputs: CandidateInput[] = rows.map((r, i) => ({
      partnerId: r.partner_id,
      distanceMeters: Number(r.distance_m),
      etaSeconds: etas[i] ?? estimateEtaSeconds(Number(r.distance_m) * 1.3),
      rating: r.rating_count ? r.rating_sum / r.rating_count : 5,
      ratingCount: r.rating_count,
      acceptanceRate: r.offers_received ? r.offers_accepted / r.offers_received : 1,
      cancellationRate: r.completed_jobs + r.cancelled_jobs ? r.cancelled_jobs / (r.completed_jobs + r.cancelled_jobs) : 0,
      recentJobs: r.recent_jobs,
      penaltyPoints: r.penalty_points,
    }));
    return scoreCandidates(inputs, { eta: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_ETA]), distance: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_DISTANCE]), rating: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_RATING]), acceptance: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_ACCEPTANCE]), cancellation: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_CANCELLATION]), workload: Number(weights[CONFIG_KEYS.DISPATCH_SCORE_W_WORKLOAD]) }, radius);
  }

  private roleFor(job: { type: JobType; category?: { requiredPartnerRole: PartnerRoleType } | null }): PartnerRoleType {
    if (job.type === JobType.RIDE) return 'DRIVER';
    if (job.type === JobType.DELIVERY) return 'COURIER';
    return job.category?.requiredPartnerRole ?? 'TECHNICIAN';
  }

  private serviceName(job: JobWithRelations): string {
    if (job.category) return job.category.nameAr;
    return job.type === JobType.RIDE ? 'مشوار' : job.type === JobType.DELIVERY ? 'توصيل' : 'خدمة';
  }

  private partnerIdOf(user: RequestUser): string {
    if (!user.partnerId) throw AppException.forbidden('Partner profile required');
    return user.partnerId;
  }
}
