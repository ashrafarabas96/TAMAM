import { AccountStatus, ErrorCode, JobStatus, MessageType, NotificationEvent, Permission, UserRole } from '@tamam/shared-types';
import type { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import type { SystemConfigService } from '../config/system-config.service';
import type { MediaUrlService } from '../media/media-url.service';
import type { MediaService } from '../media/media.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const CHAT_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const PARTNER_ID = '44444444-4444-4444-8444-444444444444';
const OUTSIDER_ID = '55555555-5555-4555-8555-555555555555';
const ZONE_ID = '66666666-6666-4666-8666-666666666666';

interface MessageRow {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  mediaId: string | null;
  lat: null;
  lng: null;
  clientMessageId: string;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  media: null;
}

function user(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: CUSTOMER_ID,
    phone: '+970599000001',
    roles: [UserRole.CUSTOMER],
    permissions: [],
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    language: 'ar',
    customerId: CUSTOMER_ID,
    isSuperAdmin: false,
    ...overrides,
  };
}

function buildHarness(options: { jobStatus?: JobStatus; closedAt?: Date | null; allowRate?: boolean } = {}) {
  const messages: MessageRow[] = [];
  const members: Array<{ chatId: string; userId: string; role: string; leftAt: Date | null }> = [
    { chatId: CHAT_ID, userId: CUSTOMER_ID, role: 'CUSTOMER', leftAt: null },
    { chatId: CHAT_ID, userId: PARTNER_ID, role: 'PARTNER', leftAt: null },
  ];

  const job = {
    id: JOB_ID,
    customerId: CUSTOMER_ID,
    partnerId: PARTNER_ID,
    status: options.jobStatus ?? JobStatus.IN_PROGRESS,
    zoneId: ZONE_ID,
  };

  const messageCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const clientMessageId = String(data.clientMessageId);
    const senderId = String(data.senderId);
    if (messages.some((m) => m.clientMessageId === clientMessageId && m.senderId === senderId)) {
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    }
    const row: MessageRow = {
      id: `msg-${messages.length + 1}`,
      chatId: String(data.chatId),
      senderId,
      type: (data.type as MessageType) ?? MessageType.TEXT,
      text: (data.text as string | null) ?? null,
      mediaId: (data.mediaId as string | null) ?? null,
      lat: null,
      lng: null,
      clientMessageId,
      deliveredAt: null,
      readAt: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      media: null,
    };
    messages.push(row);
    return row;
  });

  const prisma = {
    job: { findUnique: jest.fn(async () => job) },
    chat: {
      findUnique: jest.fn(async () => ({ id: CHAT_ID, jobId: JOB_ID, closedAt: options.closedAt ?? null })),
      upsert: jest.fn(async () => ({ id: CHAT_ID, jobId: JOB_ID, closedAt: options.closedAt ?? null })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    chatMember: {
      upsert: jest.fn(async ({ create }: { create: { chatId: string; userId: string; role: string } }) => {
        if (!members.some((m) => m.userId === create.userId)) members.push({ ...create, leftAt: null });
        return create;
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: { not: string } } }) => members.filter((m) => m.userId !== where.userId.not)),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    message: {
      create: messageCreate,
      findUnique: jest.fn(async ({ where }: { where: { chatId_senderId_clientMessageId: { senderId: string; clientMessageId: string } } }) => {
        const key = where.chatId_senderId_clientMessageId;
        return messages.find((m) => m.senderId === key.senderId && m.clientMessageId === key.clientMessageId) ?? null;
      }),
      findFirst: jest.fn(async () => messages[0] ?? null),
      findMany: jest.fn(async () => messages),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: { findUnique: jest.fn(async () => ({ fullName: 'Layla Nasser', phone: '+970599000001' })) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const assertOwnedReady = jest.fn(async () => undefined);
  const media = { assertOwnedReady } as unknown as MediaService;
  const mediaUrls = { urlFor: jest.fn(() => '/api/v1/media/key/view') } as unknown as MediaUrlService;
  const notify = jest.fn(async () => undefined);
  const notifications = { notify } as unknown as NotificationsService;
  const assertEnabled = jest.fn(async () => undefined);
  const systemConfig = { assertEnabled } as unknown as SystemConfigService;
  const hit = jest.fn(async () => ({ allowed: options.allowRate ?? true, remaining: 29, retryAfterSeconds: 60 }));
  const rateLimit = { hit } as unknown as RateLimitService;
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;
  const emitToJob = jest.fn();
  const isUserInRoom = jest.fn(async () => false);
  const gateway = { emitToJob, isUserInRoom } as unknown as ChatGateway;

  const service = new ChatService(prisma, media, mediaUrls, notifications, systemConfig, rateLimit, logger, gateway);

  return { service, messages, members, mocks: { messageCreate, emitToJob, notify, isUserInRoom, assertOwnedReady, assertEnabled, hit } };
}

describe('ChatService.send', () => {
  it('deduplicates on clientMessageId: a retried send returns the stored message and writes once', async () => {
    const { service, messages, mocks } = buildHarness();
    const input = { type: MessageType.TEXT, text: 'On my way', clientMessageId: 'client-msg-0001' } as const;

    const first = await service.send(user(), JOB_ID, input);
    const second = await service.send(user(), JOB_ID, input);

    expect(first.id).toBe(second.id);
    expect(messages).toHaveLength(1);
    expect(mocks.messageCreate).toHaveBeenCalledTimes(1);
    expect(mocks.emitToJob).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('notifies only members who are not watching the job room', async () => {
    const { service, mocks } = buildHarness();
    mocks.isUserInRoom.mockResolvedValue(true);

    await service.send(user(), JOB_ID, { type: MessageType.TEXT, text: 'Hello', clientMessageId: 'client-msg-0002' });

    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('truncates the push preview to 60 characters', async () => {
    const { service, mocks } = buildHarness();
    const long = 'x'.repeat(200);

    await service.send(user(), JOB_ID, { type: MessageType.TEXT, text: long, clientMessageId: 'client-msg-0003' });

    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: NotificationEvent.NEW_MESSAGE,
        collapseKey: `chat:${JOB_ID}`,
        vars: { senderName: 'Layla Nasser', preview: 'x'.repeat(60) },
      }),
    );
  });

  it('validates chat media against the CHAT purpose before persisting an image', async () => {
    const { service, mocks } = buildHarness();
    const mediaId = '77777777-7777-4777-8777-777777777777';

    await service.send(user(), JOB_ID, { type: MessageType.IMAGE, mediaId, clientMessageId: 'client-msg-0004' });

    expect(mocks.assertOwnedReady).toHaveBeenCalledWith(CUSTOMER_ID, [mediaId], ['CHAT']);
  });

  it('rejects a user who is neither a job party nor a support agent (canChat)', async () => {
    const { service, mocks } = buildHarness();
    const outsider = user({ id: OUTSIDER_ID, customerId: OUTSIDER_ID });

    await expect(service.send(outsider, JOB_ID, { type: MessageType.TEXT, text: 'hi', clientMessageId: 'client-msg-0005' })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it('rejects a party once the job left its active statuses (canChat)', async () => {
    const { service } = buildHarness({ jobStatus: JobStatus.COMPLETED });

    await expect(service.send(user(), JOB_ID, { type: MessageType.TEXT, text: 'hi', clientMessageId: 'client-msg-0006' })).rejects.toBeInstanceOf(AppException);
  });

  it('lets a support agent write and joins them as a SUPPORT member', async () => {
    const { service, members } = buildHarness({ jobStatus: JobStatus.COMPLETED });
    const agent = user({ id: OUTSIDER_ID, customerId: undefined, roles: [UserRole.SUPPORT], permissions: [Permission.SUPPORT_MANAGE, Permission.SUPPORT_READ] });

    await service.send(agent, JOB_ID, { type: MessageType.TEXT, text: 'Support here', clientMessageId: 'client-msg-0007' });

    expect(members).toContainEqual(expect.objectContaining({ userId: OUTSIDER_ID, role: 'SUPPORT' }));
  });

  it('refuses to write into a closed chat', async () => {
    const { service } = buildHarness({ closedAt: new Date('2026-04-01T12:00:00.000Z') });

    await expect(service.send(user(), JOB_ID, { type: MessageType.TEXT, text: 'hi', clientMessageId: 'client-msg-0008' })).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it('enforces the 30/minute send budget', async () => {
    const { service } = buildHarness({ allowRate: false });

    await expect(service.send(user(), JOB_ID, { type: MessageType.TEXT, text: 'hi', clientMessageId: 'client-msg-0009' })).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
    });
  });
});

describe('ChatService.markRead', () => {
  it('emits a delivery receipt and stores the member read watermark', async () => {
    const { service, mocks } = buildHarness();
    await service.send(user({ id: PARTNER_ID, customerId: undefined, partnerId: PARTNER_ID, roles: [UserRole.PARTNER] }), JOB_ID, {
      type: MessageType.TEXT,
      text: 'Arriving',
      clientMessageId: 'client-msg-0010',
    });
    mocks.emitToJob.mockClear();

    const receipt = await service.markRead(user(), JOB_ID, 'msg-1');

    expect(receipt).toMatchObject({ jobId: JOB_ID, upToMessageId: 'msg-1', readerId: CUSTOMER_ID });
    expect(mocks.emitToJob).toHaveBeenCalledWith(JOB_ID, 'chat:delivery', expect.objectContaining({ readerId: CUSTOMER_ID }));
  });
});
