import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ADMIN_ROLES, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type Permission, SENSITIVE_PERMISSIONS, UserRole } from '@tamam/shared-types';
import type { UpsertRoleInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';

const PERM_CACHE_TTL = 60;

/** Roles → permissions catalogue, seeded from DEFAULT_ROLE_PERMISSIONS and editable by SUPER_ADMIN. */
@Injectable()
export class RbacService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedCatalogue();
  }

  /** Idempotent: ensures every permission exists and every system role has its default bundle. */
  async seedCatalogue(): Promise<void> {
    for (const key of ALL_PERMISSIONS) {
      await this.prisma.adminPermission.upsert({
        where: { key },
        update: { isSensitive: SENSITIVE_PERMISSIONS.includes(key) },
        create: { key, description: key, isSensitive: SENSITIVE_PERMISSIONS.includes(key) },
      });
    }
    for (const role of ADMIN_ROLES) {
      const row = await this.prisma.adminRole.upsert({ where: { name: role }, update: {}, create: { name: role, description: `System role ${role}`, isSystem: true } });
      const existing = await this.prisma.adminRolePermission.count({ where: { roleId: row.id } });
      if (existing === 0) {
        await this.prisma.adminRolePermission.createMany({
          data: DEFAULT_ROLE_PERMISSIONS[role].map((permissionKey) => ({ roleId: row.id, permissionKey })),
          skipDuplicates: true,
        });
      }
    }
  }

  /** Effective permissions for a set of roles (cached per role name). */
  async permissionsForRoles(roles: UserRole[]): Promise<Permission[]> {
    const set = new Set<Permission>();
    for (const role of roles) {
      if (role === UserRole.CUSTOMER || role === UserRole.PARTNER) continue;
      const cached = await this.redis.getJson<Permission[]>(`rbac:role:${role}`);
      if (cached) {
        cached.forEach((p) => set.add(p));
        continue;
      }
      const row = await this.prisma.adminRole.findUnique({ where: { name: role }, include: { permissions: true } });
      const perms = (row?.permissions.map((p) => p.permissionKey as Permission) ?? DEFAULT_ROLE_PERMISSIONS[role] ?? []) as Permission[];
      await this.redis.setJson(`rbac:role:${role}`, perms, PERM_CACHE_TTL);
      perms.forEach((p) => set.add(p));
    }
    return [...set];
  }

  async listRoles() {
    const rows = await this.prisma.adminRole.findMany({ include: { permissions: true, _count: { select: { users: true } } }, orderBy: { name: 'asc' } });
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, permissions: r.permissions.map((p) => p.permissionKey), userCount: r._count.users, updatedAt: r.updatedAt.toISOString() }));
  }

  listPermissions(): Array<{ key: string; sensitive: boolean }> {
    return ALL_PERMISSIONS.map((key) => ({ key, sensitive: SENSITIVE_PERMISSIONS.includes(key) }));
  }

  async upsertRole(input: UpsertRoleInput, actorId: string, requestId: string | null) {
    const invalid = input.permissions.filter((p) => !(ALL_PERMISSIONS as readonly string[]).includes(p));
    if (invalid.length) throw AppException.validation([{ field: 'permissions', message: `unknown permissions: ${invalid.join(', ')}` }]);
    if (input.name === UserRole.SUPER_ADMIN) throw AppException.forbidden('SUPER_ADMIN permissions cannot be edited');
    const before = await this.prisma.adminRole.findUnique({ where: { name: input.name }, include: { permissions: true } });
    const row = await this.prisma.$transaction(async (tx: Tx) => {
      const role = await tx.adminRole.upsert({ where: { name: input.name }, update: { description: input.description }, create: { name: input.name, description: input.description, isSystem: (ADMIN_ROLES as readonly string[]).includes(input.name) } });
      await tx.adminRolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.adminRolePermission.createMany({ data: input.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })) });
      await this.audit.record({ actorId, action: 'role.upsert', entity: 'admin_role', entityId: role.id, oldValue: { permissions: before?.permissions.map((p) => p.permissionKey) ?? null }, newValue: { permissions: input.permissions }, reason: input.reason, requestId }, tx);
      return role;
    });
    await this.redis.del(`rbac:role:${input.name}`);
    return row;
  }
}
