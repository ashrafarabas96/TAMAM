import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  type NotificationDto,
  NotificationEvent,
  type Page,
} from '@tamam/shared-types';
import type { BroadcastNotificationInput, NotificationPreferencesInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../../infrastructure/providers/email/email.provider';
import {
  PUSH_PROVIDER,
  type PushProvider,
} from '../../infrastructure/providers/push/push.provider';
import { SMS_PROVIDER, type SmsProvider } from '../../infrastructure/providers/sms/sms.provider';
import { NOTIFICATION_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';

import { NotificationTemplateService } from './notification-template.service';

export interface NotifyOptions {
  userId: string;
  event: NotificationEvent;
  vars?: Record<string, string>;
  data?: Record<string, string>;
  jobId?: string;
  channels?: NotificationChannel[]; // default PUSH + IN_APP
  priority?: 'high' | 'normal';
  collapseKey?: string;
}

const TRANSACTIONAL_ONLY: NotificationEvent[] = [NotificationEvent.PROMO_CAMPAIGN];

/**
 * Unified notification service (spec §62). Callers emit an event + variables; templates,
 * channels, preferences and providers are resolved here. Delivery runs on the queue.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplateService,
    private readonly logger: PinoLogger,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /** Enqueue; never blocks the calling transaction. */
  async notify(opts: NotifyOptions): Promise<void> {
    await this.queue.add(NOTIFICATION_JOBS.SEND, opts, {
      priority: opts.priority === 'high' ? 1 : 5,
      attempts: 3,
    });
  }

  /** Worker entry: renders per channel, respects preferences, persists in-app rows, calls providers. */
  async deliver(opts: NotifyOptions): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: opts.userId },
      include: { notificationPreference: true, pushTokens: { where: { isActive: true } } },
    });
    if (!user || user.accountStatus === 'DELETED') return;
    const prefs = user.notificationPreference ?? {
      push: true,
      sms: true,
      email: false,
      marketing: true,
    };
    const language = user.language === 'en' ? 'en' : 'ar';
    const channels = opts.channels ?? [NotificationChannel.PUSH, NotificationChannel.IN_APP];
    const isMarketing = TRANSACTIONAL_ONLY.includes(opts.event);
    if (isMarketing && !prefs.marketing) return;

    for (const channel of channels) {
      const rendered = await this.templates.render(opts.event, channel, language, opts.vars ?? {});
      const row = await this.prisma.notification.create({
        data: {
          userId: user.id,
          event: opts.event,
          channel,
          title: rendered.title,
          body: rendered.body,
          data: opts.data ?? undefined,
          jobId: opts.jobId ?? null,
        },
      });
      try {
        if (channel === NotificationChannel.IN_APP) {
          await this.prisma.notification.update({
            where: { id: row.id },
            data: { status: 'DELIVERED', sentAt: new Date() },
          });
        } else if (channel === NotificationChannel.PUSH) {
          if (!prefs.push || !user.pushTokens.length) {
            await this.prisma.notification.update({
              where: { id: row.id },
              data: { status: 'FAILED', failureReason: prefs.push ? 'no_token' : 'disabled' },
            });
            continue;
          }
          const res = await this.push.send({
            tokens: user.pushTokens.map((t) => t.token),
            title: rendered.title,
            body: rendered.body,
            data: {
              event: opts.event,
              ...(opts.jobId ? { jobId: opts.jobId } : {}),
              ...(opts.data ?? {}),
            },
            priority: opts.priority ?? 'normal',
            collapseKey: opts.collapseKey,
          });
          if (res.invalidTokens.length)
            await this.prisma.pushToken.updateMany({
              where: { token: { in: res.invalidTokens } },
              data: { isActive: false },
            });
          await this.prisma.notification.update({
            where: { id: row.id },
            data: {
              status: res.sent > 0 ? 'SENT' : 'FAILED',
              sentAt: new Date(),
              failureReason: res.sent > 0 ? null : 'provider_failed',
            },
          });
        } else if (channel === NotificationChannel.SMS) {
          if (!prefs.sms && opts.event !== NotificationEvent.OTP_CODE) {
            await this.prisma.notification.update({
              where: { id: row.id },
              data: { status: 'FAILED', failureReason: 'disabled' },
            });
            continue;
          }
          const res = await this.sms.send({
            to: user.phone,
            body: rendered.body,
            category:
              opts.event === NotificationEvent.OTP_CODE
                ? 'OTP'
                : isMarketing
                  ? 'MARKETING'
                  : 'TRANSACTIONAL',
          });
          await this.prisma.notification.update({
            where: { id: row.id },
            data: {
              status: res.accepted ? 'SENT' : 'FAILED',
              sentAt: new Date(),
              providerRef: res.providerRef,
            },
          });
        } else if (channel === NotificationChannel.EMAIL) {
          if (!prefs.email || !user.email) {
            await this.prisma.notification.update({
              where: { id: row.id },
              data: { status: 'FAILED', failureReason: user.email ? 'disabled' : 'no_email' },
            });
            continue;
          }
          const res = await this.email.send({
            to: user.email,
            subject: rendered.title,
            text: rendered.body,
          });
          await this.prisma.notification.update({
            where: { id: row.id },
            data: {
              status: res.accepted ? 'SENT' : 'FAILED',
              sentAt: new Date(),
              providerRef: res.providerRef,
            },
          });
        }
      } catch (err) {
        this.logger.warn({ err, channel, event: opts.event }, 'notification delivery failed');
        await this.prisma.notification.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            failureReason: err instanceof Error ? err.message.slice(0, 300) : 'error',
          },
        });
      }
    }
  }

  async list(
    userId: string,
    cursorRaw: string | undefined,
    limit: number,
    unreadOnly: boolean,
  ): Promise<Page<NotificationDto>> {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: unreadOnly ? null : undefined,
        ...cursorWhere(cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (n) => ({
      id: n.id,
      event: n.event as NotificationEvent,
      channel: n.channel,
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, unknown> | null) ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, channel: NotificationChannel.IN_APP, readAt: null },
    });
  }

  async markRead(userId: string, ids: string[] | 'all'): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        channel: NotificationChannel.IN_APP,
        readAt: null,
        ...(ids === 'all' ? {} : { id: { in: ids } }),
      },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async getPreferences(userId: string) {
    const p = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return { push: p.push, sms: p.sms, email: p.email, marketing: p.marketing };
  }

  async updatePreferences(userId: string, input: NotificationPreferencesInput) {
    const p = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });
    return { push: p.push, sms: p.sms, email: p.email, marketing: p.marketing };
  }

  /** Admin broadcast → fan-out job per user (paged) so a 100k audience never blocks a request. */
  async broadcast(input: BroadcastNotificationInput, actorId: string): Promise<{ queued: number }> {
    const roleFilter = input.audiences.map((a) => (a === 'PARTNER' ? 'PARTNER' : 'CUSTOMER'));
    let queued = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          roles: { some: { role: { in: roleFilter as ('CUSTOMER' | 'PARTNER')[] } } },
          ...(input.zoneIds.length
            ? {
                OR: [
                  { partner: { zones: { some: { zoneId: { in: input.zoneIds } } } } },
                  { customer: { jobs: { some: { zoneId: { in: input.zoneIds } } } } },
                ],
              }
            : {}),
        },
        select: { id: true, language: true },
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });
      if (!users.length) break;
      await this.queue.addBulk(
        users.map((u) => ({
          name: NOTIFICATION_JOBS.SEND,
          data: {
            userId: u.id,
            event: NotificationEvent.PROMO_CAMPAIGN,
            channels: input.channels,
            vars: {
              title: u.language === 'en' ? input.title.en : input.title.ar,
              body: u.language === 'en' ? input.body.en : input.body.ar,
            },
            data: input.deepLink ? { deepLink: input.deepLink } : undefined,
            priority: 'normal',
          } satisfies NotifyOptions,
          opts: {
            delay: input.scheduledFor
              ? Math.max(0, new Date(input.scheduledFor).getTime() - Date.now())
              : 0,
            attempts: 2,
          },
        })),
      );
      queued += users.length;
      cursor = users[users.length - 1]?.id;
      if (users.length < 500) break;
    }
    this.logger.info({ actorId, queued }, 'broadcast queued');
    return { queued };
  }
}
