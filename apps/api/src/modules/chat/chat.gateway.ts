import { Inject, forwardRef } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AccountStatus, ErrorCode, WsEvent, WsNamespace } from '@tamam/shared-types';
import { markReadSchema, sendMessageSchema, uuidSchema } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';

import { parseOrThrow } from '../../common/decorators/zod.decorator';
import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { TokenService } from '../auth/token.service';
import { MetricsService } from '../metrics/metrics.service';

import { ChatService } from './chat.service';

/* ------------------------------------------------------------- contracts */

const jobRoomSchema = z.object({ jobId: uuidSchema });
const chatReadSchema = markReadSchema.extend({ jobId: uuidSchema });

/** Payload emitted on `WsEvent.ERROR` — clients translate by `code`, never by message. */
export interface WsErrorPayload {
  code: string;
  message: string;
}

export interface WsAck<T> {
  ok: boolean;
  data?: T;
  error?: WsErrorPayload;
}

/** Data we attach to every socket so `fetchSockets()` identifies members across API replicas. */
interface ChatSocketData {
  userId: string;
}

export const jobRoom = (jobId: string): string => `job:${jobId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

function socketUserId(socket: { data: unknown }): string | null {
  const data = socket.data as Partial<ChatSocketData> | null | undefined;
  return data && typeof data.userId === 'string' ? data.userId : null;
}

function handshakeToken(socket: Socket): string | null {
  const raw: unknown = socket.handshake.auth?.token;
  if (typeof raw !== 'string' || !raw.length) return null;
  return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
}

/**
 * Chat namespace (spec §23/§25). Authentication happens once at handshake time; every
 * subscription is re-checked against `JobPolicy.canChat`, so a socket can only ever see the
 * rooms of jobs its principal is a party to (or a support agent for).
 */
@WebSocketGateway({ namespace: WsNamespace.CHAT })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server;

  /** socket.id → principal, for the sockets connected to *this* replica. */
  private readonly principals = new Map<string, RequestUser>();

  constructor(
    private readonly tokens: TokenService,
    private readonly metrics: MetricsService,
    private readonly logger: PinoLogger,
    @Inject(forwardRef(() => ChatService)) private readonly chat: ChatService,
  ) {}

  /* ----------------------------------------------------------- connection */

  async handleConnection(socket: Socket): Promise<void> {
    const token = handshakeToken(socket);
    const principal = token ? await this.tokens.resolvePrincipal(token) : null;
    if (!principal) {
      this.fail(socket, AppException.unauthenticated('A valid access token is required'));
      socket.disconnect(true);
      return;
    }
    if (principal.accountStatus === AccountStatus.SUSPENDED) {
      this.fail(socket, AppException.forbidden('Your account is suspended. Contact support.', ErrorCode.ACCOUNT_SUSPENDED));
      socket.disconnect(true);
      return;
    }

    socket.data = { userId: principal.id } satisfies ChatSocketData;
    this.principals.set(socket.id, principal);
    await socket.join(userRoom(principal.id));
    this.metrics.wsConnections.inc({ namespace: WsNamespace.CHAT });
  }

  handleDisconnect(socket: Socket): void {
    if (this.principals.delete(socket.id)) this.metrics.wsConnections.dec({ namespace: WsNamespace.CHAT });
  }

  /* ------------------------------------------------------------- handlers */

  @SubscribeMessage(WsEvent.SUBSCRIBE_JOB)
  async subscribeJob(socket: Socket, payload: unknown): Promise<WsAck<{ jobId: string }>> {
    return this.handle(socket, WsEvent.SUBSCRIBE_JOB, async (user) => {
      const { jobId } = parseOrThrow(jobRoomSchema, payload);
      const job = await this.chat.loadJob(jobId);
      await this.chat.assertChatAllowed(user, job);
      await socket.join(jobRoom(jobId));
      return { jobId };
    });
  }

  @SubscribeMessage(WsEvent.UNSUBSCRIBE_JOB)
  async unsubscribeJob(socket: Socket, payload: unknown): Promise<WsAck<{ jobId: string }>> {
    return this.handle(socket, WsEvent.UNSUBSCRIBE_JOB, async () => {
      const { jobId } = parseOrThrow(jobRoomSchema, payload);
      await socket.leave(jobRoom(jobId));
      return { jobId };
    });
  }

  @SubscribeMessage(WsEvent.CHAT_SEND)
  async chatSend(socket: Socket, payload: unknown): Promise<WsAck<unknown>> {
    return this.handle(socket, WsEvent.CHAT_SEND, async (user) => {
      // Parsed twice on purpose: the room id and the message body are independent contracts.
      const { jobId } = parseOrThrow(jobRoomSchema, payload);
      return this.chat.send(user, jobId, parseOrThrow(sendMessageSchema, payload));
    });
  }

  @SubscribeMessage(WsEvent.CHAT_READ)
  async chatRead(socket: Socket, payload: unknown): Promise<WsAck<unknown>> {
    return this.handle(socket, WsEvent.CHAT_READ, async (user) => {
      const { jobId, upToMessageId } = parseOrThrow(chatReadSchema, payload);
      return this.chat.markRead(user, jobId, upToMessageId);
    });
  }

  /* --------------------------------------------------------------- egress */

  /** Fan-out to everyone currently watching a job, on any replica. */
  emitToJob(jobId: string, event: string, payload: unknown): void {
    this.server?.to(jobRoom(jobId)).emit(event, payload);
  }

  /**
   * True when the user has at least one socket in the job room. Uses `fetchSockets()` so remote
   * replicas are included — a push notification must not be sent to someone already reading.
   */
  async isUserInRoom(userId: string, jobId: string): Promise<boolean> {
    if (!this.server) return false;
    try {
      const sockets = await this.server.in(jobRoom(jobId)).fetchSockets();
      return sockets.some((socket) => socketUserId(socket) === userId);
    } catch (err) {
      // Presence is an optimisation: if the adapter cannot answer, fall back to notifying.
      this.logger.warn({ err, jobId }, 'chat presence lookup failed');
      return false;
    }
  }

  /* -------------------------------------------------------------- plumbing */

  private async handle<T>(socket: Socket, event: string, run: (user: RequestUser) => Promise<T>): Promise<WsAck<T>> {
    const user = this.principals.get(socket.id);
    if (!user) {
      const error = this.fail(socket, AppException.unauthenticated());
      socket.disconnect(true);
      return { ok: false, error };
    }
    try {
      return { ok: true, data: await run(user) };
    } catch (err) {
      if (err instanceof AppException) return { ok: false, error: this.fail(socket, err) };
      this.logger.error({ err, event, userId: user.id }, 'chat gateway handler failed');
      return { ok: false, error: this.fail(socket, AppException.internal()) };
    }
  }

  private fail(socket: Socket, err: AppException): WsErrorPayload {
    const payload: WsErrorPayload = { code: String(err.code), message: err.message };
    socket.emit(WsEvent.ERROR, payload);
    return payload;
  }
}
