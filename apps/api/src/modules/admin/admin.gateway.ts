import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type JobOfferDto, type JobStatus, type LocationSample, Permission, WsEvent, WsNamespace } from '@tamam/shared-types';
import { Logger } from 'nestjs-pino';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';

import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { TokenService } from '../auth/token.service';
import { DispatchEvents } from '../dispatch/dispatch.service';
import { JobDomainEvents, type JobStatusChangedEvent } from '../jobs/domain/job-events';
import { MetricsService } from '../metrics/metrics.service';
import { TrackingEvents } from '../tracking/tracking.service';

type AuthedSocket = Socket & { data: { user?: RequestUser; subscribed?: boolean } };

const subscribeSchema = z.object({ zoneId: z.string().uuid().optional() });

const ALL_ROOM = 'admin:all';
const zoneRoom = (zoneId: string): string => `admin:zone:${zoneId}`;
/** How long a jobId → zoneId lookup stays valid. A job never changes zone, but the map is bounded. */
const ZONE_CACHE_TTL_MS = 5 * 60_000;
const ZONE_CACHE_MAX = 5_000;
const METRICS_INTERVAL_MS = 15_000;

interface AdminMapUpdate {
  kind: 'LOCATION' | 'JOB_STATUS' | 'SOS' | 'OFFER';
  zoneId: string | null;
  jobId: string | null;
  partnerId: string | null;
  at: string;
  payload: Record<string, unknown>;
}

/**
 * `/admin` namespace (spec §140–§141): the live operations map and the rolling ops metrics.
 *
 * Rooms are per zone (`admin:zone:<id>`) plus a global `admin:all`, so a dispatcher scoped to
 * one city never receives another city's traffic. Only holders of TRACKING_VIEW_LIVE_MAP may
 * subscribe — connecting alone gives no data.
 */
@Injectable()
@WebSocketGateway({ namespace: WsNamespace.ADMIN })
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  /** jobId → { zoneId, expiresAt } so a burst of location samples costs one query per job. */
  private readonly jobZones = new Map<string, { zoneId: string; expiresAt: number }>();
  private subscribers = 0;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {}

  /* --------------------------------------------------------- lifecycle */
  async handleConnection(socket: AuthedSocket): Promise<void> {
    const header = socket.handshake.headers.authorization;
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    const user = token ? await this.tokens.resolvePrincipal(token) : null;
    if (!user) {
      socket.emit(WsEvent.ERROR, { code: 'UNAUTHENTICATED' });
      socket.disconnect(true);
      return;
    }
    if (!this.canViewMap(user)) {
      socket.emit(WsEvent.ERROR, { code: 'FORBIDDEN' });
      socket.disconnect(true);
      return;
    }
    socket.data.user = user;
    await socket.join(`user:${user.id}`);
    this.metrics.wsConnections.inc({ namespace: 'admin' });
  }

  handleDisconnect(socket: AuthedSocket): void {
    if (!socket.data.user) return;
    this.metrics.wsConnections.dec({ namespace: 'admin' });
    if (socket.data.subscribed) {
      socket.data.subscribed = false;
      this.subscribers = Math.max(0, this.subscribers - 1);
    }
  }

  /* -------------------------------------------------------- subscribe */
  @SubscribeMessage(WsEvent.ADMIN_SUBSCRIBE_MAP)
  async onSubscribeMap(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown): Promise<unknown> {
    const user = socket.data.user;
    if (!user) return { error: 'UNAUTHENTICATED' };
    if (!this.canViewMap(user)) return { error: 'FORBIDDEN' };
    const parsed = subscribeSchema.safeParse(body ?? {});
    if (!parsed.success) return { error: 'VALIDATION_FAILED' };

    const room = parsed.data.zoneId ? zoneRoom(parsed.data.zoneId) : ALL_ROOM;
    if (parsed.data.zoneId) {
      const zone = await this.prisma.serviceZone.findUnique({ where: { id: parsed.data.zoneId }, select: { id: true } });
      if (!zone) return { error: 'NOT_FOUND' };
    }
    // One room at a time: re-subscribing swaps the scope instead of accumulating rooms.
    for (const current of [...socket.rooms]) {
      if (current.startsWith('admin:')) await socket.leave(current);
    }
    await socket.join(room);
    if (!socket.data.subscribed) {
      socket.data.subscribed = true;
      this.subscribers += 1;
    }
    return { ok: true, room };
  }

  /* ----------------------------------------------------------- fan-out */
  @OnEvent(TrackingEvents.LOCATION)
  async onLocation(payload: { partnerId: string; jobId: string; sample: LocationSample }): Promise<void> {
    const zoneId = await this.zoneForJob(payload.jobId);
    this.broadcast({
      kind: 'LOCATION',
      zoneId,
      jobId: payload.jobId,
      partnerId: payload.partnerId,
      at: payload.sample.timestamp,
      payload: { lat: payload.sample.lat, lng: payload.sample.lng, heading: payload.sample.heading ?? null, speed: payload.sample.speed ?? null },
    });
  }

  @OnEvent(JobDomainEvents.STATUS_CHANGED)
  onStatusChanged(payload: JobStatusChangedEvent): void {
    this.rememberZone(payload.jobId, payload.zoneId);
    this.broadcast({
      kind: 'JOB_STATUS',
      zoneId: payload.zoneId,
      jobId: payload.jobId,
      partnerId: payload.partnerId,
      at: payload.at,
      payload: { from: payload.from, to: payload.to, jobType: payload.jobType, actorType: payload.actorType, customerId: payload.customerId },
    });
  }

  /** `job.sos` is emitted by JobSafetyService — the highest-priority event on the map. */
  @OnEvent('job.sos')
  onSos(payload: { jobId: string; alertId: string; userId: string; zoneId: string; location: { lat: number; lng: number }; status: JobStatus }): void {
    this.rememberZone(payload.jobId, payload.zoneId);
    this.broadcast({
      kind: 'SOS',
      zoneId: payload.zoneId,
      jobId: payload.jobId,
      partnerId: null,
      at: new Date().toISOString(),
      payload: { alertId: payload.alertId, userId: payload.userId, lat: payload.location.lat, lng: payload.location.lng, jobStatus: payload.status },
    });
  }

  @OnEvent(DispatchEvents.OFFER)
  onOffer(payload: { partnerId: string; offer: JobOfferDto }): void {
    const zoneId = payload.offer.job.zoneId;
    this.rememberZone(payload.offer.job.id, zoneId);
    this.broadcast({
      kind: 'OFFER',
      zoneId,
      jobId: payload.offer.job.id,
      partnerId: payload.partnerId,
      at: new Date().toISOString(),
      payload: { assignmentId: payload.offer.assignmentId, wave: payload.offer.wave, expiresAt: payload.offer.expiresAt, etaToPickupSeconds: payload.offer.etaToPickupSeconds },
    });
  }

  /* ----------------------------------------------------------- metrics */
  /** Pushes the ops dashboard to `admin:all` every 15 s — only while somebody is watching. */
  @Interval('admin-metrics', METRICS_INTERVAL_MS)
  async pushMetrics(): Promise<void> {
    if (!this.server || this.subscribers === 0) return;
    try {
      const dashboard = await this.analytics.opsDashboard();
      this.server.to(ALL_ROOM).emit(WsEvent.ADMIN_METRICS, dashboard);
    } catch (err) {
      this.logger.warn({ err }, 'admin metrics push failed');
    }
  }

  /* ----------------------------------------------------------- helpers */
  private canViewMap(user: RequestUser): boolean {
    return user.isSuperAdmin || user.permissions.includes(Permission.TRACKING_VIEW_LIVE_MAP);
  }

  private broadcast(update: AdminMapUpdate): void {
    if (!this.server) return;
    this.server.to(ALL_ROOM).emit(WsEvent.ADMIN_MAP_UPDATE, update);
    if (update.zoneId) this.server.to(zoneRoom(update.zoneId)).emit(WsEvent.ADMIN_MAP_UPDATE, update);
  }

  private rememberZone(jobId: string, zoneId: string): void {
    if (this.jobZones.size >= ZONE_CACHE_MAX) this.jobZones.clear();
    this.jobZones.set(jobId, { zoneId, expiresAt: Date.now() + ZONE_CACHE_TTL_MS });
  }

  private async zoneForJob(jobId: string): Promise<string | null> {
    const cached = this.jobZones.get(jobId);
    if (cached && cached.expiresAt > Date.now()) return cached.zoneId;
    this.jobZones.delete(jobId);
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { zoneId: true } });
    if (!job) return null;
    this.rememberZone(jobId, job.zoneId);
    return job.zoneId;
  }
}
