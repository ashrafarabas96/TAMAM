import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, type GeoPoint, JobStatus, type LiveMapJobDto, type LiveMapPartnerDto, type LocationSample, RiskSignal } from '@tamam/shared-types';
import type { LiveMapQueryInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { haversineMeters } from '../../common/utils/geo';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MAPS_PROVIDER, type MapsProvider } from '../../infrastructure/providers/maps/maps.provider';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemConfigService } from '../config/system-config.service';
import type { JobWithRelations } from '../jobs/jobs.types';
import { MetricsService } from '../metrics/metrics.service';
import { RiskService } from '../risk/risk.service';

/** While the partner is still heading to the pickup, the ETA is measured to the first stop. */
const BEFORE_START_STATUSES: readonly JobStatus[] = [JobStatus.ASSIGNED, JobStatus.PARTNER_EN_ROUTE];

export interface PartnerLocationState {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number;
  timestamp: string;
  jobId: string | null;
}

export const TrackingEvents = {
  LOCATION: 'tracking.location', // { partnerId, jobId, sample }
  ETA: 'tracking.eta', // { jobId, etaToPickupSeconds, etaToDestinationSeconds, remainingMeters }
  IMPOSSIBLE_MOVEMENT: 'tracking.impossible_movement',
} as const;

/**
 * Live tracking (spec §23–§26): validates every sample (auth is in the gateway), rejects stale
 * / inaccurate / physically impossible points, keeps the latest position in Redis (hot path) and
 * partner_availability (cold), appends to job_tracking_points while a job is active, and
 * recomputes ETAs with the routing provider at a bounded cadence.
 */
@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: SystemConfigService,
    private readonly metrics: MetricsService,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
    @Inject(forwardRef(() => RiskService)) private readonly risk: RiskService,
    @Inject(MAPS_PROVIDER) private readonly maps: MapsProvider,
  ) {}

  /** Ingest samples from a partner (WS or REST fallback). Returns accepted count + the job's current ETA. */
  async ingestForPartner(partnerId: string, samples: LocationSample[], jobIdHint?: string): Promise<{ accepted: number; rejected: number; etaToPickupSeconds: number | null; etaToDestinationSeconds: number | null }> {
    const [maxStale, maxAccuracy, maxSpeedKmh] = await Promise.all([this.config.getNumber(CONFIG_KEYS.TRACKING_MAX_STALE_S), this.config.getNumber(CONFIG_KEYS.TRACKING_MAX_ACCURACY_M), this.config.getNumber(CONFIG_KEYS.TRACKING_MAX_SPEED_KMH)]);
    const availability = await this.prisma.partnerAvailability.findUnique({ where: { partnerId }, select: { currentJobId: true, status: true } });
    const jobId = availability?.currentJobId ?? null;
    if (jobIdHint && jobId && jobIdHint !== jobId) throw AppException.forbidden('Location does not belong to your active job');
    let previous = await this.redis.getJson<PartnerLocationState>(`loc:${partnerId}`);
    const ordered = [...samples].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const accepted: LocationSample[] = [];
    let rejected = 0;
    const now = Date.now();
    for (const s of ordered) {
      const ts = Date.parse(s.timestamp);
      if (Number.isNaN(ts) || now - ts > maxStale * 1000 || ts - now > 30_000) { rejected += 1; this.metrics.locationUpdates.inc({ result: 'stale' }); continue; }
      if (s.accuracy > maxAccuracy) { rejected += 1; this.metrics.locationUpdates.inc({ result: 'inaccurate' }); continue; }
      if (previous) {
        const dt = (ts - Date.parse(previous.timestamp)) / 1000;
        if (dt <= 0) { rejected += 1; this.metrics.locationUpdates.inc({ result: 'out_of_order' }); continue; }
        const meters = haversineMeters(previous, s);
        const kmh = (meters / dt) * 3.6;
        if (kmh > maxSpeedKmh && meters > 200) {
          rejected += 1;
          this.metrics.locationUpdates.inc({ result: 'impossible' });
          this.events.emit(TrackingEvents.IMPOSSIBLE_MOVEMENT, { partnerId, jobId, kmh: Math.round(kmh), meters: Math.round(meters), seconds: Math.round(dt) });
          await this.risk.recordSignal(partnerId, RiskSignal.IMPOSSIBLE_GPS_MOVEMENT, Math.min(100, Math.round(kmh / 10)), { kmh: Math.round(kmh), meters: Math.round(meters), seconds: Math.round(dt) }, jobId ?? undefined);
          continue;
        }
      }
      accepted.push(s);
      previous = { lat: s.lat, lng: s.lng, heading: s.heading ?? null, speed: s.speed ?? null, accuracy: s.accuracy, timestamp: s.timestamp, jobId };
    }
    if (!accepted.length) return { accepted: 0, rejected, etaToPickupSeconds: null, etaToDestinationSeconds: null };
    const latest = accepted[accepted.length - 1];
    if (!latest) return { accepted: 0, rejected, etaToPickupSeconds: null, etaToDestinationSeconds: null };
    this.metrics.locationUpdates.inc({ result: 'accepted' }, accepted.length);

    await this.redis.setJson(`loc:${partnerId}`, previous, 600);
    await this.prisma.partnerAvailability.update({ where: { partnerId }, data: { lat: new Prisma.Decimal(latest.lat), lng: new Prisma.Decimal(latest.lng), heading: latest.heading === undefined ? null : new Prisma.Decimal(latest.heading), speed: latest.speed === undefined ? null : new Prisma.Decimal(latest.speed), accuracy: new Prisma.Decimal(latest.accuracy), lastLocationAt: new Date(latest.timestamp), lastHeartbeatAt: new Date() } });

    let eta: { etaToPickupSeconds: number | null; etaToDestinationSeconds: number | null } = { etaToPickupSeconds: null, etaToDestinationSeconds: null };
    if (jobId) {
      await this.prisma.jobTrackingPoint.createMany({ data: accepted.map((s) => ({ jobId, partnerId, lat: new Prisma.Decimal(s.lat), lng: new Prisma.Decimal(s.lng), accuracy: new Prisma.Decimal(s.accuracy), heading: s.heading === undefined ? null : new Prisma.Decimal(s.heading), speed: s.speed === undefined ? null : new Prisma.Decimal(s.speed), recordedAt: new Date(s.timestamp) })) });
      this.events.emit(TrackingEvents.LOCATION, { partnerId, jobId, sample: latest });
      eta = await this.maybeRefreshEta(jobId, latest);
    }
    return { accepted: accepted.length, rejected, ...eta };
  }

  async latestPartnerLocation(partnerId: string): Promise<PartnerLocationState | null> {
    const cached = await this.redis.getJson<PartnerLocationState>(`loc:${partnerId}`);
    if (cached) return cached;
    const row = await this.prisma.partnerAvailability.findUnique({ where: { partnerId } });
    if (!row?.lat || !row.lng || !row.lastLocationAt) return null;
    return { lat: row.lat.toNumber(), lng: row.lng.toNumber(), heading: row.heading?.toNumber() ?? null, speed: row.speed?.toNumber() ?? null, accuracy: row.accuracy?.toNumber() ?? 0, timestamp: row.lastLocationAt.toISOString(), jobId: row.currentJobId };
  }

  /** ETA refresh at most every 20 s per job (routing provider quota), always on status changes. */
  private async maybeRefreshEta(jobId: string, from: GeoPoint): Promise<{ etaToPickupSeconds: number | null; etaToDestinationSeconds: number | null }> {
    const key = `eta:lock:${jobId}`;
    const ok = await this.redis.client.set(key, '1', 'EX', 20, 'NX');
    const cached = await this.redis.getJson<{ etaToPickupSeconds: number | null; etaToDestinationSeconds: number | null }>(`eta:${jobId}`);
    if (ok !== 'OK' && cached) return cached;
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { stops: { orderBy: { sequence: 'asc' } } } });
    if (!job) return { etaToPickupSeconds: null, etaToDestinationSeconds: null };
    return this.computeEta(job, from);
  }

  async refreshEta(job: JobWithRelations): Promise<number | null> {
    const loc = job.partnerId ? await this.latestPartnerLocation(job.partnerId) : null;
    if (!loc) return job.etaToPickupSeconds;
    const eta = await this.computeEta(job, loc);
    return eta.etaToPickupSeconds ?? eta.etaToDestinationSeconds;
  }

  private async computeEta(job: { id: string; status: JobStatus; stops: Array<{ kind: string; lat: Prisma.Decimal; lng: Prisma.Decimal }> }, from: GeoPoint): Promise<{ etaToPickupSeconds: number | null; etaToDestinationSeconds: number | null }> {
    const pickup = job.stops[0];
    const dest = job.stops[job.stops.length - 1];
    const beforeStart = BEFORE_START_STATUSES.includes(job.status);
    let etaToPickupSeconds: number | null = null;
    let etaToDestinationSeconds: number | null = null;
    let remainingMeters: number | null = null;
    try {
      if (beforeStart && pickup) {
        const r = await this.maps.route(from, { lat: pickup.lat.toNumber(), lng: pickup.lng.toNumber() });
        etaToPickupSeconds = r.durationSeconds;
        remainingMeters = r.distanceMeters;
      } else if (job.status === JobStatus.IN_PROGRESS && dest && dest !== pickup) {
        const r = await this.maps.route(from, { lat: dest.lat.toNumber(), lng: dest.lng.toNumber() });
        etaToDestinationSeconds = r.durationSeconds;
        remainingMeters = r.distanceMeters;
      }
    } catch (err) {
      this.logger.warn({ err, jobId: job.id }, 'ETA routing failed');
    }
    const result = { etaToPickupSeconds, etaToDestinationSeconds };
    await this.redis.setJson(`eta:${job.id}`, result, 120);
    if (etaToPickupSeconds !== null || etaToDestinationSeconds !== null) {
      await this.prisma.job.update({ where: { id: job.id }, data: { etaToPickupSeconds: etaToPickupSeconds ?? undefined, etaToDestinationSeconds: etaToDestinationSeconds ?? undefined } });
      this.events.emit(TrackingEvents.ETA, { jobId: job.id, ...result, remainingMeters });
    }
    return result;
  }

  /** Actual distance/duration from tracking points (spec §29): sums consecutive accepted points since the job started. */
  async jobActuals(jobId: string, since: Date): Promise<{ distanceMeters: number; durationSeconds: number }> {
    const points = await this.prisma.jobTrackingPoint.findMany({ where: { jobId, recordedAt: { gte: since } }, orderBy: { recordedAt: 'asc' }, select: { lat: true, lng: true, recordedAt: true } });
    let distance = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) continue;
      const d = haversineMeters({ lat: a.lat.toNumber(), lng: a.lng.toNumber() }, { lat: b.lat.toNumber(), lng: b.lng.toNumber() });
      if (d < 5) continue; // GPS jitter while stationary
      distance += d;
    }
    const first = points[0];
    const last = points[points.length - 1];
    const duration = first && last ? Math.round((last.recordedAt.getTime() - first.recordedAt.getTime()) / 1000) : Math.round((Date.now() - since.getTime()) / 1000);
    return { distanceMeters: Math.round(distance), durationSeconds: Math.max(0, duration) };
  }

  /** Recent path for a job (customer app polyline / admin replay). */
  async jobPath(jobId: string, limit = 500): Promise<GeoPoint[]> {
    const points = await this.prisma.jobTrackingPoint.findMany({ where: { jobId }, orderBy: { recordedAt: 'desc' }, take: limit, select: { lat: true, lng: true } });
    return points.reverse().map((p) => ({ lat: p.lat.toNumber(), lng: p.lng.toNumber() }));
  }

  /** Live ops map data, scoped by zone/bbox (spec §77 — least privilege enforced by the caller's permission). */
  async liveMap(q: LiveMapQueryInput): Promise<{ partners: LiveMapPartnerDto[]; jobs: LiveMapJobDto[] }> {
    const heartbeatMax = await this.config.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S);
    const bbox = q.bbox ? q.bbox.split(',').map(Number) as [number, number, number, number] : null;
    const partners: LiveMapPartnerDto[] = q.includePartners
      ? (await this.prisma.$queryRaw<Array<{ partner_id: string; status: string; lat: number; lng: number; heading: number | null; current_job_id: string | null; last_heartbeat_at: Date; roles: string[] }>>`
          SELECT pa.partner_id, pa.status::text AS status, pa.lat::float8 AS lat, pa.lng::float8 AS lng, pa.heading::float8 AS heading, pa.current_job_id, pa.last_heartbeat_at,
                 ARRAY(SELECT role::text FROM partner_roles WHERE partner_id = pa.partner_id AND is_active) AS roles
          FROM partner_availability pa
          ${q.zoneId ? Prisma.sql`JOIN partner_zones pz ON pz.partner_id = pa.partner_id AND pz.zone_id = ${q.zoneId}::uuid` : Prisma.empty}
          WHERE pa.status IN ('ONLINE','BUSY') AND pa.location IS NOT NULL AND pa.last_heartbeat_at > now() - (${heartbeatMax}::int * interval '1 second')
          ${bbox ? Prisma.sql`AND pa.lng BETWEEN ${bbox[0]} AND ${bbox[2]} AND pa.lat BETWEEN ${bbox[1]} AND ${bbox[3]}` : Prisma.empty}
          LIMIT 2000`).map((r) => ({ partnerId: r.partner_id, availability: r.status as LiveMapPartnerDto['availability'], roles: r.roles as LiveMapPartnerDto['roles'], location: { lat: r.lat, lng: r.lng }, heading: r.heading, activeJobId: r.current_job_id, lastSeenAt: r.last_heartbeat_at.toISOString() }))
      : [];
    const jobs: LiveMapJobDto[] = q.includeJobs
      ? (await this.prisma.job.findMany({ where: { zoneId: q.zoneId, status: { in: [JobStatus.REQUESTED, JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.PARTNER_EN_ROUTE, JobStatus.PARTNER_ARRIVED, JobStatus.WAITING_CUSTOMER, JobStatus.IN_PROGRESS, JobStatus.INSPECTION_STARTED, JobStatus.WORK_STARTED] } }, include: { stops: { orderBy: { sequence: 'asc' } } }, take: 2000, orderBy: { createdAt: 'desc' } }))
          .map((j) => {
            const p = j.stops[0];
            const d = j.stops[j.stops.length - 1];
            return { jobId: j.id, number: j.number, type: j.type, status: j.status, pickup: p ? { lat: p.lat.toNumber(), lng: p.lng.toNumber() } : { lat: 0, lng: 0 }, destination: d && d !== p ? { lat: d.lat.toNumber(), lng: d.lng.toNumber() } : null, partnerId: j.partnerId, createdAt: j.createdAt.toISOString() };
          })
          .filter((j) => !bbox || (j.pickup.lng >= bbox[0] && j.pickup.lng <= bbox[2] && j.pickup.lat >= bbox[1] && j.pickup.lat <= bbox[3]))
      : [];
    return { partners, jobs };
  }

  /** Maintenance: delete tracking points older than the retention policy (spec §92). */
  async purgeOldPoints(): Promise<number> {
    const days = await this.config.getNumber(CONFIG_KEYS.TRACKING_RETENTION_DAYS);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const res = await this.prisma.jobTrackingPoint.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    return res.count;
  }

  /** Adaptive interval hint for partner apps (spec §24). */
  async intervalHint(hasActiveJob: boolean): Promise<number> {
    return this.config.getNumber(hasActiveJob ? CONFIG_KEYS.TRACKING_INTERVAL_ACTIVE_S : CONFIG_KEYS.TRACKING_INTERVAL_IDLE_S);
  }

  assertNotStaleForArrival(sample: LocationSample, maxStaleSeconds: number): void {
    if (Date.now() - Date.parse(sample.timestamp) > maxStaleSeconds * 1000) throw AppException.badRequest(ErrorCode.STALE_LOCATION, 'Location sample is too old');
  }
}
