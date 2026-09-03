import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type MediaAsset, type Message, Prisma } from '@prisma/client';
import {
  type ChatMessageDto,
  ErrorCode,
  FEATURE_FLAGS,
  MediaPurpose,
  MessageType,
  NotificationEvent,
  type Page,
  Permission,
  WsEvent,
} from '@tamam/shared-types';
import type { SendMessageInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import { SystemConfigService } from '../config/system-config.service';
import { type JobLike, JobPolicy } from '../jobs/domain/job-policy';
import { MediaUrlService } from '../media/media-url.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

import { ChatGateway } from './chat.gateway';

/* ------------------------------------------------------------- contracts */

/** `chat_members.role` is a VarChar — these are the only values the platform writes. */
export const ChatMemberRole = { CUSTOMER: 'CUSTOMER', PARTNER: 'PARTNER', SUPPORT: 'SUPPORT' } as const;
export type ChatMemberRole = (typeof ChatMemberRole)[keyof typeof ChatMemberRole];

export interface ChatSummary {
  id: string;
  jobId: string;
  closedAt: string | null;
}

/** Server → client payload for `WsEvent.CHAT_DELIVERY` after a read receipt. */
export interface ChatReadReceipt {
  jobId: string;
  upToMessageId: string;
  readerId: string;
  readAt: string;
  /** Number of messages moved into the read state by this call. */
  count: number;
}

/** Server → client payload for `WsEvent.CHAT_DELIVERY` after a delivery acknowledgement. */
export interface ChatDeliveryReceipt {
  jobId: string;
  messageIds: string[];
  deliveredBy: string;
  deliveredAt: string;
  count: number;
}

interface JobAssignedEventLike {
  jobId: string;
  partnerId?: string | null;
}

interface JobFinishedEventLike {
  jobId: string;
}

type MessageWithMedia = Message & { media: MediaAsset | null };

const messageInclude = { media: true } satisfies Prisma.MessageInclude;

/** 30 sends per minute per user — enforced in the service so HTTP and WebSocket share one budget. */
const SEND_LIMIT = 30;
const SEND_WINDOW_S = 60;
const PREVIEW_MAX = 60;

/** Language-neutral previews for messages that carry no text (spec §8: no hard-coded prose). */
const NON_TEXT_PREVIEW: Record<Exclude<MessageType, 'TEXT'>, string> = {
  IMAGE: '📷',
  LOCATION: '📍',
  SYSTEM: '•',
};

/**
 * In-job chat (spec §60). One chat per job, opened when the job is created and closed when the
 * job ends; membership mirrors the job parties, and support agents join the moment they write.
 * Messages are deduplicated on the client-supplied `clientMessageId` so a retried send after a
 * dropped socket never produces a double bubble.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly notifications: NotificationsService,
    private readonly systemConfig: SystemConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly logger: PinoLogger,
    @Inject(forwardRef(() => ChatGateway)) private readonly gateway: ChatGateway,
  ) {}

  /* ------------------------------------------------------------ lifecycle */

  /**
   * Creates the chat and its member rows for a job. Idempotent: callers (job creation,
   * assignment, the first message) may run it as often as they like, inside a transaction or not.
   */
  async ensureForJob(jobId: string, tx?: Tx): Promise<ChatSummary> {
    const client = tx ?? this.prisma;
    const job = await client.job.findUnique({ where: { id: jobId }, select: { id: true, customerId: true, partnerId: true } });
    if (!job) throw AppException.notFound('Job', jobId);

    const chat = await client.chat.upsert({ where: { jobId: job.id }, update: {}, create: { jobId: job.id }, select: { id: true, jobId: true, closedAt: true } });
    await this.joinMember(chat.id, job.customerId, ChatMemberRole.CUSTOMER, client);
    if (job.partnerId) await this.joinMember(chat.id, job.partnerId, ChatMemberRole.PARTNER, client);
    return this.toChatSummary(chat);
  }

  /** Called on assignment (and re-assignment) so the newly assigned partner can talk to the customer. */
  async addPartner(jobId: string, partnerId: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    const chat = await client.chat.upsert({ where: { jobId }, update: {}, create: { jobId }, select: { id: true } });
    await this.joinMember(chat.id, partnerId, ChatMemberRole.PARTNER, client);
  }

  /** Closes the chat: history stays readable, new messages are refused. Idempotent. */
  async close(jobId: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    await client.chat.updateMany({ where: { jobId, closedAt: null }, data: { closedAt: new Date() } });
  }

  private async joinMember(chatId: string, userId: string, role: ChatMemberRole, client: PrismaService | Tx): Promise<void> {
    await client.chatMember.upsert({
      where: { chatId_userId: { chatId, userId } },
      update: { leftAt: null },
      create: { chatId, userId, role },
    });
  }

  /* ------------------------------------------------------------- listeners */

  @OnEvent('job.assigned')
  async onJobAssigned(event: JobAssignedEventLike): Promise<void> {
    try {
      const partnerId = event.partnerId ?? (await this.prisma.job.findUnique({ where: { id: event.jobId }, select: { partnerId: true } }))?.partnerId;
      if (!partnerId) return;
      await this.addPartner(event.jobId, partnerId);
    } catch (err) {
      // A listener must never break the job pipeline; the partner joins again on their first send.
      this.logger.error({ err, jobId: event.jobId }, 'chat member could not be added on assignment');
    }
  }

  @OnEvent('job.completed')
  @OnEvent('job.cancelled')
  async onJobFinished(event: JobFinishedEventLike): Promise<void> {
    try {
      await this.close(event.jobId);
    } catch (err) {
      this.logger.error({ err, jobId: event.jobId }, 'chat could not be closed');
    }
  }

  /* ------------------------------------------------------------------ read */

  async listMessages(user: RequestUser, jobId: string, cursorRaw: string | undefined, limit: number): Promise<Page<ChatMessageDto>> {
    const job = await this.loadJob(jobId);
    await this.assertChatAllowed(user, job);
    const chat = await this.chatForJob(jobId);
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.message.findMany({
      where: { chatId: chat.id, ...cursorWhere(cursor) },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (row) => this.toDto(row));
  }

  /* ------------------------------------------------------------------ send */

  /**
   * Persists and fans out one message. Idempotent per `(chat, sender, clientMessageId)`, so the
   * mobile apps may safely resend after a reconnect.
   */
  async send(user: RequestUser, jobId: string, input: SendMessageInput): Promise<ChatMessageDto> {
    const job = await this.loadJob(jobId);
    await this.assertChatAllowed(user, job);

    const chat = await this.chatForJob(jobId);
    if (chat.closedAt) throw AppException.conflict('This chat is closed', ErrorCode.CONFLICT);

    const role = this.memberRoleFor(user, job);
    if (!role) throw AppException.forbidden('You are not a member of this chat');

    await this.assertSendRate(user.id);

    const duplicate = await this.findByClientId(chat.id, user.id, input.clientMessageId);
    if (duplicate) return this.toDto(duplicate);

    if (input.type === MessageType.IMAGE) {
      if (!input.mediaId) throw AppException.validation([{ field: 'mediaId', message: 'mediaId is required for IMAGE messages' }]);
      await this.media.assertOwnedReady(user.id, [input.mediaId], [MediaPurpose.CHAT]);
    }

    // Support agents become members the first time they write; parties are already joined.
    await this.joinMember(chat.id, user.id, role, this.prisma);

    const created = await this.createMessage(chat.id, user.id, input);
    const dto = this.toDto(created);

    this.gateway.emitToJob(jobId, WsEvent.CHAT_MESSAGE, dto);
    await this.notifyAbsentMembers(chat.id, jobId, user, created);
    return dto;
  }

  private async createMessage(chatId: string, senderId: string, input: SendMessageInput): Promise<MessageWithMedia> {
    try {
      return await this.prisma.message.create({
        data: {
          chatId,
          senderId,
          type: input.type,
          text: input.type === MessageType.TEXT ? (input.text ?? null) : null,
          mediaId: input.type === MessageType.IMAGE ? (input.mediaId ?? null) : null,
          lat: input.type === MessageType.LOCATION && input.location ? input.location.lat : null,
          lng: input.type === MessageType.LOCATION && input.location ? input.location.lng : null,
          clientMessageId: input.clientMessageId,
        },
        include: messageInclude,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.findByClientId(chatId, senderId, input.clientMessageId);
        if (raced) return raced;
      }
      throw err;
    }
  }

  private findByClientId(chatId: string, senderId: string, clientMessageId: string): Promise<MessageWithMedia | null> {
    return this.prisma.message.findUnique({
      where: { chatId_senderId_clientMessageId: { chatId, senderId, clientMessageId } },
      include: messageInclude,
    });
  }

  /** Push only reaches members who are not already watching this job's room on some device. */
  private async notifyAbsentMembers(chatId: string, jobId: string, sender: RequestUser, message: MessageWithMedia): Promise<void> {
    const members = await this.prisma.chatMember.findMany({
      where: { chatId, userId: { not: sender.id }, leftAt: null },
      select: { userId: true },
    });
    if (!members.length) return;
    const senderName = await this.displayName(sender.id);
    const preview = this.previewOf(message);
    for (const member of members) {
      if (await this.gateway.isUserInRoom(member.userId, jobId)) continue;
      await this.notifications.notify({
        userId: member.userId,
        event: NotificationEvent.NEW_MESSAGE,
        vars: { senderName, preview },
        data: { jobId, chatId, messageId: message.id },
        jobId,
        collapseKey: `chat:${jobId}`,
      });
    }
  }

  /* --------------------------------------------------------------- receipts */

  /** Marks every message from the other members up to (and including) `upToMessageId` as read. */
  async markRead(user: RequestUser, jobId: string, upToMessageId: string): Promise<ChatReadReceipt> {
    const job = await this.loadJob(jobId);
    await this.assertChatAllowed(user, job);
    const chat = await this.chatForJob(jobId);

    const upTo = await this.prisma.message.findFirst({ where: { id: upToMessageId, chatId: chat.id }, select: { id: true, createdAt: true } });
    if (!upTo) throw AppException.notFound('Message', upToMessageId);

    const readAt = new Date();
    const count = await this.prisma.$transaction(async (tx) => {
      await tx.message.updateMany({
        where: { chatId: chat.id, senderId: { not: user.id }, deliveredAt: null, createdAt: { lte: upTo.createdAt } },
        data: { deliveredAt: readAt },
      });
      const read = await tx.message.updateMany({
        where: { chatId: chat.id, senderId: { not: user.id }, readAt: null, createdAt: { lte: upTo.createdAt } },
        data: { readAt },
      });
      await tx.chatMember.updateMany({ where: { chatId: chat.id, userId: user.id }, data: { lastReadAt: readAt } });
      return read.count;
    });

    const receipt: ChatReadReceipt = { jobId, upToMessageId: upTo.id, readerId: user.id, readAt: readAt.toISOString(), count };
    this.gateway.emitToJob(jobId, WsEvent.CHAT_DELIVERY, receipt);
    return receipt;
  }

  /** Acknowledges that the listed messages reached the recipient's device. */
  async markDelivered(user: RequestUser, jobId: string, messageIds: string[]): Promise<ChatDeliveryReceipt> {
    const job = await this.loadJob(jobId);
    await this.assertChatAllowed(user, job);
    const chat = await this.chatForJob(jobId);

    const deliveredAt = new Date();
    const updated = messageIds.length
      ? await this.prisma.message.updateMany({
          where: { chatId: chat.id, id: { in: messageIds }, senderId: { not: user.id }, deliveredAt: null },
          data: { deliveredAt },
        })
      : { count: 0 };

    const receipt: ChatDeliveryReceipt = { jobId, messageIds, deliveredBy: user.id, deliveredAt: deliveredAt.toISOString(), count: updated.count };
    if (updated.count > 0) this.gateway.emitToJob(jobId, WsEvent.CHAT_DELIVERY, receipt);
    return receipt;
  }

  /* --------------------------------------------------------------- helpers */

  /** The job shape every chat policy check needs (also used by the gateway on subscribe). */
  async loadJob(jobId: string): Promise<JobLike> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, partnerId: true, status: true, zoneId: true },
    });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  /**
   * Feature flag + object-level authorization in one place. Staff bypass the flag so support can
   * still read and answer a conversation while chat is being rolled out zone by zone.
   */
  async assertChatAllowed(user: RequestUser, job: JobLike): Promise<void> {
    if (!JobPolicy.isStaff(user)) await this.systemConfig.assertEnabled(FEATURE_FLAGS.CHAT, { userId: user.id, zoneId: job.zoneId });
    if (!JobPolicy.canChat(user, job)) throw AppException.forbidden('You cannot access the chat of this job');
  }

  private async chatForJob(jobId: string): Promise<ChatSummary> {
    const existing = await this.prisma.chat.findUnique({ where: { jobId }, select: { id: true, jobId: true, closedAt: true } });
    if (existing) return this.toChatSummary(existing);
    return this.ensureForJob(jobId);
  }

  private memberRoleFor(user: RequestUser, job: JobLike): ChatMemberRole | null {
    if (JobPolicy.isCustomer(user, job)) return ChatMemberRole.CUSTOMER;
    if (JobPolicy.isAssignedPartner(user, job)) return ChatMemberRole.PARTNER;
    if (user.isSuperAdmin || user.permissions.includes(Permission.SUPPORT_MANAGE)) return ChatMemberRole.SUPPORT;
    return null;
  }

  private async assertSendRate(userId: string): Promise<void> {
    const result = await this.rateLimit.hit(`chat:send:${userId}`, SEND_LIMIT, SEND_WINDOW_S);
    if (!result.allowed) throw AppException.rateLimited(result.retryAfterSeconds);
  }

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
    return user?.fullName ?? user?.phone ?? '';
  }

  private previewOf(message: MessageWithMedia): string {
    if (message.type === MessageType.TEXT) return (message.text ?? '').slice(0, PREVIEW_MAX);
    return NON_TEXT_PREVIEW[message.type] ?? '';
  }

  private toChatSummary(chat: { id: string; jobId: string; closedAt: Date | null }): ChatSummary {
    return { id: chat.id, jobId: chat.jobId, closedAt: chat.closedAt ? chat.closedAt.toISOString() : null };
  }

  toDto(message: MessageWithMedia): ChatMessageDto {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      type: message.type,
      text: message.text,
      mediaUrl: message.media ? this.mediaUrls.urlFor(message.media, 'medium') : null,
      location: message.lat !== null && message.lng !== null ? { lat: message.lat.toNumber(), lng: message.lng.toNumber() } : null,
      deliveredAt: message.deliveredAt ? message.deliveredAt.toISOString() : null,
      readAt: message.readAt ? message.readAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
