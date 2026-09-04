import type { Prisma } from '@prisma/client';
import {
  ADMIN_ROLES,
  ALL_PERMISSIONS,
  CONFIG_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  FEATURE_FLAG_DEFAULTS,
  type NotificationChannel,
  NotificationEvent,
  SENSITIVE_PERMISSIONS,
} from '@tamam/shared-types';

import { DEFAULT_TEMPLATES } from '../../src/modules/notifications/notification-template.service';
import type { SeedContext } from './context';

const CHANNELS: NotificationChannel[] = ['PUSH', 'IN_APP', 'SMS', 'EMAIL'];

/**
 * Platform baseline: runtime config, feature flags, the RBAC catalogue and notification
 * templates. Mirrors `SystemConfigService.ensureDefaults()`, `RbacService.seedCatalogue()` and
 * `NotificationTemplateService.seedDefaults()` with direct upserts so the seed never has to
 * boot the Nest application. Running it twice changes nothing.
 */
export async function seedPlatform(ctx: SeedContext): Promise<void> {
  const { prisma, summary } = ctx;

  for (const def of CONFIG_DEFINITIONS) {
    await prisma.systemConfig.upsert({
      where: { key: def.key },
      update: {
        description: def.description,
        min: def.min ?? null,
        max: def.max ?? null,
        unit: def.unit ?? null,
        group: def.group,
        type: def.type,
      },
      create: {
        key: def.key,
        value: def.default as Prisma.InputJsonValue,
        type: def.type,
        description: def.description,
        min: def.min ?? null,
        max: def.max ?? null,
        unit: def.unit ?? null,
        group: def.group,
      },
    });
  }
  summary.set('system configs', CONFIG_DEFINITIONS.length);

  for (const [key, def] of Object.entries(FEATURE_FLAG_DEFAULTS)) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { description: def.description },
      create: { key, description: def.description, enabled: def.enabled },
    });
  }
  summary.set('feature flags', Object.keys(FEATURE_FLAG_DEFAULTS).length);

  for (const key of ALL_PERMISSIONS) {
    await prisma.adminPermission.upsert({
      where: { key },
      update: { isSensitive: SENSITIVE_PERMISSIONS.includes(key) },
      create: { key, description: key, isSensitive: SENSITIVE_PERMISSIONS.includes(key) },
    });
  }
  summary.set('admin permissions', ALL_PERMISSIONS.length);

  for (const role of ADMIN_ROLES) {
    const row = await prisma.adminRole.upsert({
      where: { name: role },
      update: { description: `System role ${role}` },
      create: { name: role, description: `System role ${role}`, isSystem: true },
    });
    // Replace the bundle so a changed DEFAULT_ROLE_PERMISSIONS is reflected in development.
    await prisma.adminRolePermission.deleteMany({ where: { roleId: row.id } });
    await prisma.adminRolePermission.createMany({
      data: DEFAULT_ROLE_PERMISSIONS[role].map((permissionKey) => ({
        roleId: row.id,
        permissionKey,
      })),
      skipDuplicates: true,
    });
  }
  summary.set('admin roles', ADMIN_ROLES.length);

  let templates = 0;
  for (const event of Object.values(NotificationEvent)) {
    const def = DEFAULT_TEMPLATES[event];
    if (!def) continue;
    for (const channel of CHANNELS) {
      await prisma.notificationTemplate.upsert({
        where: { event_channel: { event, channel } },
        update: {},
        create: {
          event,
          channel,
          titleAr: def.ar.title,
          titleEn: def.en.title,
          bodyAr: def.ar.body,
          bodyEn: def.en.body,
        },
      });
      templates += 1;
    }
  }
  summary.set('notification templates', templates);

  // Sequence helpers the SQL migration also seeds — harmless to re-assert.
  await prisma.counter.createMany({
    data: [
      { key: 'job_number', value: 0n },
      { key: 'ticket_number', value: 0n },
      { key: 'dispute_number', value: 0n },
      { key: 'receipt_number', value: 0n },
    ],
    skipDuplicates: true,
  });
}
