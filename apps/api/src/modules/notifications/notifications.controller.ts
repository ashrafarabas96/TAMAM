import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import {
  type BroadcastNotificationInput,
  broadcastNotificationSchema,
  notificationListSchema,
  type NotificationPreferencesInput,
  notificationPreferencesSchema,
  notificationTemplateKeySchema,
  type UpsertNotificationTemplateInput,
  upsertNotificationTemplateSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  Audited,
  CurrentUser,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { NotificationTemplateService } from './notification-template.service';
import { NotificationsService } from './notifications.service';

const markReadSchema = z.object({
  ids: z.union([z.literal('all'), z.array(z.string().uuid()).min(1).max(200)]),
});

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly templates: NotificationTemplateService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('notifications')
  @AllowRestricted()
  list(
    @CurrentUser() user: RequestUser,
    @ZodQuery(notificationListSchema) q: { cursor?: string; limit: number; unreadOnly: boolean },
  ) {
    return this.notifications.list(user.id, q.cursor, q.limit, q.unreadOnly);
  }

  @Get('notifications/unread-count')
  @AllowRestricted()
  async unread(@CurrentUser() user: RequestUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('notifications/read')
  @HttpCode(200)
  @AllowRestricted()
  async markRead(
    @CurrentUser() user: RequestUser,
    @ZodBody(markReadSchema) body: { ids: 'all' | string[] },
  ) {
    await this.notifications.markRead(user.id, body.ids);
    return { ok: true };
  }

  @Get('notifications/preferences')
  @AllowRestricted()
  prefs(@CurrentUser() user: RequestUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Put('notifications/preferences')
  @AllowRestricted()
  updatePrefs(
    @CurrentUser() user: RequestUser,
    @ZodBody(notificationPreferencesSchema) input: NotificationPreferencesInput,
  ) {
    return this.notifications.updatePreferences(user.id, input);
  }

  /* ---------------------------------------------------------------- admin */
  @Get('admin/notification-templates')
  @RequirePermission(Permission.NOTIFICATION_TEMPLATES_MANAGE)
  listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ event: 'asc' }, { channel: 'asc' }],
    });
  }

  @Put('admin/notification-templates')
  @RequirePermission(Permission.NOTIFICATION_TEMPLATES_MANAGE)
  @Audited({ action: 'notification_template.upsert', entity: 'notification_template' })
  async upsertTemplate(
    @ZodBody(upsertNotificationTemplateSchema) input: UpsertNotificationTemplateInput,
    @CurrentUser() user: RequestUser,
  ) {
    const row = await this.prisma.notificationTemplate.upsert({
      where: { event_channel: { event: input.event, channel: input.channel } },
      update: {
        titleAr: input.title.ar,
        titleEn: input.title.en,
        bodyAr: input.body.ar,
        bodyEn: input.body.en,
        isActive: input.isActive,
        updatedById: user.id,
      },
      create: {
        event: input.event,
        channel: input.channel,
        titleAr: input.title.ar,
        titleEn: input.title.en,
        bodyAr: input.body.ar,
        bodyEn: input.body.en,
        isActive: input.isActive,
        updatedById: user.id,
      },
    });
    await this.templates.invalidate(input.event, input.channel);
    return row;
  }

  /**
   * A template is addressed by (event, channel), the same key the upsert uses. Deleting it
   * restores the built-in copy for that pairing; without this route an override created by
   * mistake could only be deactivated, never removed.
   */
  @Delete('admin/notification-templates/:event/:channel')
  @HttpCode(204)
  @RequirePermission(Permission.NOTIFICATION_TEMPLATES_MANAGE)
  @Audited({ action: 'notification_template.delete', entity: 'notification_template' })
  async deleteTemplate(
    @Param('event') event: string,
    @Param('channel') channel: string,
  ): Promise<void> {
    const parsed = notificationTemplateKeySchema.safeParse({ event, channel });
    if (!parsed.success)
      throw AppException.validation(
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    const key = { event: parsed.data.event, channel: parsed.data.channel };
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { event_channel: key },
    });
    if (!existing) throw AppException.notFound('Notification template', `${event}/${channel}`);
    await this.prisma.notificationTemplate.delete({ where: { event_channel: key } });
    await this.templates.invalidate(key.event, key.channel);
  }

  @Post('admin/notifications/broadcast')
  @RequirePermission(Permission.NOTIFICATIONS_BROADCAST)
  @Audited({ action: 'notification.broadcast', entity: 'notification', sensitive: true })
  broadcast(
    @ZodBody(broadcastNotificationSchema) input: BroadcastNotificationInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notifications.broadcast(input, user.id);
  }
}
