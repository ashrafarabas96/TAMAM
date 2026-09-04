import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type JobOfferDto, type LocationSample, WsEvent, WsNamespace } from '@tamam/shared-types';
import { locationBatchSchema } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';

import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { DispatchEvents } from '../dispatch/dispatch.service';
import { JobDomainEvents, type JobStatusChangedEvent } from '../jobs/domain/job-events';
import { JobPolicy } from '../jobs/domain/job-policy';
import { MetricsService } from '../metrics/metrics.service';

import { TrackingEvents, TrackingService } from './tracking.service';

type AuthedSocket = Socket & { data: { user?: RequestUser } };

const subscribeSchema = z.object({ jobId: z.string().uuid() });

/**
 * `/tracking` namespace (spec §23, §25):
 *  - partners push `partner:location` batches (validated + persisted by TrackingService)
 *  - customers/partners/admins `job:subscribe` after JobPolicy.canTrack → room `job:<id>`
 *  - server fans out `job:location`, `job:status`, `job:eta`, and partner `job:offer` events
 */
@Injectable()
@WebSocketGateway({ namespace: WsNamespace.TRACKING })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingService,
    private readonly metrics: MetricsService,
    private readonly logger: PinoLogger,
  ) {}

  async handleConnection(socket: AuthedSocket): Promise<void> {
    const token =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);
    const user = token ? await this.tokens.resolvePrincipal(token) : null;
    if (!user) {
      socket.emit(WsEvent.ERROR, { code: 'UNAUTHENTICATED' });
      socket.disconnect(true);
      return;
    }
    socket.data.user = user;
    await socket.join(`user:${user.id}`);
    this.metrics.wsConnections.inc({ namespace: 'tracking' });
    if (user.partnerId) {
      const availability = await this.prisma.partnerAvailability.findUnique({
        where: { partnerId: user.partnerId },
        select: { currentJobId: true },
      });
      socket.emit('tracking:config', {
        intervalSeconds: await this.tracking.intervalHint(!!availability?.currentJobId),
      });
    }
  }

  handleDisconnect(socket: AuthedSocket): void {
    if (socket.data.user) this.metrics.wsConnections.dec({ namespace: 'tracking' });
  }

  @SubscribeMessage(WsEvent.PARTNER_LOCATION)
  async onPartnerLocation(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<unknown> {
    const user = socket.data.user;
    if (!user?.partnerId) return { error: 'FORBIDDEN' };
    const parsed = locationBatchSchema.safeParse(body);
    if (!parsed.success) return { error: 'VALIDATION_FAILED' };
    try {
      const res = await this.tracking.ingestForPartner(
        user.partnerId,
        parsed.data.samples as LocationSample[],
        parsed.data.jobId,
      );
      return { ok: true, ...res };
    } catch (err) {
      this.logger.warn({ err, partnerId: user.partnerId }, 'location ingest failed');
      return { error: err instanceof Error ? err.message : 'INGEST_FAILED' };
    }
  }

  @SubscribeMessage(WsEvent.SUBSCRIBE_JOB)
  async onSubscribe(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<unknown> {
    const user = socket.data.user;
    const parsed = subscribeSchema.safeParse(body);
    if (!user || !parsed.success) return { error: 'VALIDATION_FAILED' };
    const job = await this.prisma.job.findUnique({
      where: { id: parsed.data.jobId },
      select: {
        id: true,
        customerId: true,
        partnerId: true,
        status: true,
        zoneId: true,
        etaToPickupSeconds: true,
        etaToDestinationSeconds: true,
      },
    });
    if (!job || !JobPolicy.canTrack(user, job)) return { error: 'FORBIDDEN' };
    await socket.join(`job:${job.id}`);
    const location = job.partnerId
      ? await this.tracking.latestPartnerLocation(job.partnerId)
      : null;
    return {
      ok: true,
      status: job.status,
      location,
      etaToPickupSeconds: job.etaToPickupSeconds,
      etaToDestinationSeconds: job.etaToDestinationSeconds,
    };
  }

  @SubscribeMessage(WsEvent.UNSUBSCRIBE_JOB)
  async onUnsubscribe(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<unknown> {
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return { error: 'VALIDATION_FAILED' };
    await socket.leave(`job:${parsed.data.jobId}`);
    return { ok: true };
  }

  /* ----------------------------------------------------------- fan-out */
  @OnEvent(TrackingEvents.LOCATION)
  onLocation(payload: { partnerId: string; jobId: string; sample: LocationSample }): void {
    this.server.to(`job:${payload.jobId}`).emit(WsEvent.JOB_LOCATION, {
      jobId: payload.jobId,
      lat: payload.sample.lat,
      lng: payload.sample.lng,
      heading: payload.sample.heading ?? null,
      speed: payload.sample.speed ?? null,
      timestamp: payload.sample.timestamp,
    });
  }

  @OnEvent(TrackingEvents.ETA)
  onEta(payload: {
    jobId: string;
    etaToPickupSeconds: number | null;
    etaToDestinationSeconds: number | null;
    remainingMeters: number | null;
  }): void {
    this.server.to(`job:${payload.jobId}`).emit(WsEvent.JOB_ETA, payload);
  }

  @OnEvent(JobDomainEvents.STATUS_CHANGED)
  onStatus(payload: JobStatusChangedEvent): void {
    this.server.to(`job:${payload.jobId}`).emit(WsEvent.JOB_STATUS, {
      jobId: payload.jobId,
      status: payload.to,
      from: payload.from,
      at: payload.at,
    });
    this.server.to(`user:${payload.customerId}`).emit(WsEvent.JOB_STATUS, {
      jobId: payload.jobId,
      status: payload.to,
      from: payload.from,
      at: payload.at,
    });
    if (payload.partnerId)
      this.server.to(`user:${payload.partnerId}`).emit(WsEvent.JOB_STATUS, {
        jobId: payload.jobId,
        status: payload.to,
        from: payload.from,
        at: payload.at,
      });
  }

  @OnEvent(DispatchEvents.OFFER)
  onOffer(payload: { partnerId: string; offer: JobOfferDto }): void {
    this.server.to(`user:${payload.partnerId}`).emit(WsEvent.JOB_OFFER, payload.offer);
  }

  @OnEvent(DispatchEvents.OFFER_EXPIRED)
  onOfferExpired(payload: { partnerId: string; jobId: string; assignmentId: string | null }): void {
    this.server.to(`user:${payload.partnerId}`).emit(WsEvent.JOB_OFFER_EXPIRED, {
      jobId: payload.jobId,
      assignmentId: payload.assignmentId,
    });
  }

  emitJobStatus(job: {
    id: string;
    status: string;
    customerId: string;
    partnerId: string | null;
  }): void {
    this.server.to(`job:${job.id}`).emit(WsEvent.JOB_STATUS, {
      jobId: job.id,
      status: job.status,
      at: new Date().toISOString(),
    });
  }
}
