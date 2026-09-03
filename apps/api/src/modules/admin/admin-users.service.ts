import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ADMIN_ROLES, type Page, type UserDto, UserRole } from '@tamam/shared-types';
import type { AccountStatusActionInput, CreateAdminUserInput, PageRequestInput, UpdateAdminRolesInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { normalizePhone } from '../../common/utils/phone';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { TokenService } from '../auth/token.service';
import { UsersService } from '../users/users.service';

/** Prisma include that satisfies `UsersService.toDto`. */
const staffInclude = {
  roles: true,
  profileImage: true,
  customer: true,
  partner: { include: { roles: true, availability: true } },
} as const;

/** A staff row plus the credential metadata the admin UI needs (never the hash). */
export interface StaffUserDto {
  user: UserDto;
  email: string | null;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

export interface TemporaryPasswordResult {
  userId: string;
  email: string;
  /** Shown exactly once — never stored in plaintext and never logged. */
  temporaryPassword: string;
  mustChangePassword: true;
  revokedSessions: number;
}

const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_DIGITS = '23456789';
const PASSWORD_SYMBOLS = '!@#$%^&*-_=+';

/**
 * Generates a 16-character temporary password that satisfies `adminChangePasswordSchema`
 * (>= 12 chars, one upper, one lower, one digit) so the holder can sign in and rotate it.
 */
export function generateTemporaryPassword(): string {
  const pools = [PASSWORD_UPPER, PASSWORD_LOWER, PASSWORD_DIGITS, PASSWORD_SYMBOLS];
  const chars: string[] = pools.map((pool) => pool[randomInt(0, pool.length)] as string);
  const all = pools.join('');
  while (chars.length < 16) chars.push(all[randomInt(0, all.length)] as string);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const a = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = a;
  }
  return chars.join('');
}

/**
 * Staff account administration (spec §139, §142): who can sign in to the admin panel, with
 * which roles, and how their credentials are reset. Customers/partners are managed by
 * `UsersService` / `PartnersService` — this service only ever touches admin identities.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------------------------------------------- read */
  async list(filter: PageRequestInput & { q?: string; role?: UserRole }): Promise<Page<StaffUserDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.user.findMany({
      where: {
        ...cursorWhere(cursor),
        deletedAt: null,
        roles: { some: { role: filter.role ?? { in: [...ADMIN_ROLES] } } },
        ...(filter.q
          ? { OR: [{ fullName: { contains: filter.q, mode: 'insensitive' as const } }, { email: { contains: filter.q, mode: 'insensitive' as const } }, { phone: { contains: filter.q } }] }
          : {}),
      },
      include: { ...staffInclude, adminCredential: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (row) => this.toStaffDto(row));
  }

  async get(id: string): Promise<StaffUserDto> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: { ...staffInclude, adminCredential: true } });
    if (!row || row.deletedAt) throw AppException.notFound('Staff user', id);
    this.assertStaff(row.roles.map((r) => r.role));
    return this.toStaffDto(row);
  }

  /* ------------------------------------------------------------- create */
  /**
   * Creates a staff identity: `users` row + `admin_credentials` (argon2id) + `user_roles`.
   * A phone number is mandatory — `users.phone` is a NOT NULL UNIQUE column and a fabricated
   * placeholder would collide and break OTP recovery, so the request is rejected instead.
   */
  async create(input: CreateAdminUserInput, actor: RequestUser, requestId: string | null): Promise<StaffUserDto> {
    const roles = this.assertAssignableRoles(input.roles, actor);
    if (!input.phone) throw AppException.validation([{ field: 'phone', message: 'a phone number is required for staff accounts' }]);
    const phone = normalizePhone(input.phone);
    const email = input.email.trim().toLowerCase();

    const [phoneClash, emailClash, credentialClash] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.adminCredential.findUnique({ where: { email }, select: { userId: true } }),
    ]);
    if (phoneClash) throw AppException.conflict('A user with this phone number already exists');
    if (emailClash || credentialClash) throw AppException.conflict('A user with this email already exists');

    const passwordHash = await AuthService.hashPassword(input.temporaryPassword);
    const roleIds = await this.adminRoleIds(roles);

    const userId = await this.prisma.$transaction(async (tx: Tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          email,
          fullName: input.fullName,
          phoneVerifiedAt: null,
          notificationPreference: { create: {} },
          adminCredential: { create: { email, passwordHash, mustChangePassword: true } },
          roles: { create: roles.map((role) => ({ role, adminRoleId: roleIds.get(role) ?? null, grantedBy: actor.id })) },
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'admin_user.create',
          entity: 'user',
          entityId: user.id,
          newValue: { email, fullName: input.fullName, roles },
          reason: `staff account created by ${actor.id}`,
          requestId,
        },
        tx,
      );
      return user.id;
    });
    return this.get(userId);
  }

  /* -------------------------------------------------------------- roles */
  async updateRoles(targetId: string, input: UpdateAdminRolesInput, actor: RequestUser, requestId: string | null): Promise<StaffUserDto> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: { roles: true } });
    if (!target || target.deletedAt) throw AppException.notFound('Staff user', targetId);
    const before = target.roles.map((r) => r.role);
    this.assertStaff(before);
    const next = this.assertAssignableRoles(input.roles, actor);

    // Nobody may drop their own SUPER_ADMIN — that is how an installation locks itself out (spec §142).
    if (targetId === actor.id && before.includes(UserRole.SUPER_ADMIN) && !next.includes(UserRole.SUPER_ADMIN)) {
      throw AppException.forbidden('You cannot remove your own SUPER_ADMIN role');
    }
    if (before.includes(UserRole.SUPER_ADMIN) && !next.includes(UserRole.SUPER_ADMIN)) {
      const remaining = await this.prisma.userRoleAssignment.count({ where: { role: UserRole.SUPER_ADMIN, userId: { not: targetId }, user: { deletedAt: null } } });
      if (remaining === 0) throw AppException.conflict('At least one SUPER_ADMIN must remain');
    }

    const roleIds = await this.adminRoleIds(next);
    // CUSTOMER / PARTNER assignments belong to the app identity and are never touched here.
    const keep = before.filter((r) => r === UserRole.CUSTOMER || r === UserRole.PARTNER);

    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId: targetId, role: { notIn: keep } } });
      for (const role of next) {
        await tx.userRoleAssignment.upsert({
          where: { userId_role: { userId: targetId, role } },
          update: { adminRoleId: roleIds.get(role) ?? null, grantedBy: actor.id },
          create: { userId: targetId, role, adminRoleId: roleIds.get(role) ?? null, grantedBy: actor.id },
        });
      }
      await this.audit.record(
        { actorId: actor.id, action: 'admin_user.roles_update', entity: 'user', entityId: targetId, oldValue: { roles: before }, newValue: { roles: next }, reason: input.reason, requestId },
        tx,
      );
    });
    await this.tokens.invalidatePrincipalCache(targetId);
    return this.get(targetId);
  }

  /* ---------------------------------------------------------- passwords */
  async resetPassword(targetId: string, actor: RequestUser, reason: string, requestId: string | null): Promise<TemporaryPasswordResult> {
    const credential = await this.prisma.adminCredential.findUnique({ where: { userId: targetId }, include: { user: { include: { roles: true } } } });
    if (!credential) throw AppException.notFound('Admin credential', targetId);
    this.assertStaff(credential.user.roles.map((r) => r.role));
    if (credential.user.roles.some((r) => r.role === UserRole.SUPER_ADMIN) && !actor.isSuperAdmin) {
      throw AppException.forbidden('Only a SUPER_ADMIN can reset a SUPER_ADMIN password');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await AuthService.hashPassword(temporaryPassword);
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.adminCredential.update({
        where: { userId: targetId },
        data: { passwordHash, mustChangePassword: true, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
      });
      await this.audit.record({ actorId: actor.id, action: 'admin_user.password_reset', entity: 'user', entityId: targetId, reason, requestId }, tx);
    });
    const revokedSessions = await this.sessions.revokeAll(targetId, 'admin_password_reset');
    await this.tokens.invalidatePrincipalCache(targetId);
    return { userId: targetId, email: credential.email, temporaryPassword, mustChangePassword: true, revokedSessions };
  }

  /* ------------------------------------------------------------- status */
  async changeStatus(targetId: string, input: AccountStatusActionInput, actor: RequestUser, requestId: string | null): Promise<UserDto> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: { roles: true } });
    if (!target) throw AppException.notFound('Staff user', targetId);
    this.assertStaff(target.roles.map((r) => r.role));
    if (targetId === actor.id) throw AppException.forbidden('You cannot change your own account status');
    const dto = await this.users.changeAccountStatus(targetId, input, actor.id, requestId);
    await this.tokens.invalidatePrincipalCache(targetId);
    return dto;
  }

  /* ------------------------------------------------------------ helpers */
  private assertStaff(roles: UserRole[]): void {
    if (!roles.some((r) => (ADMIN_ROLES as readonly UserRole[]).includes(r))) throw AppException.notFound('Staff user');
  }

  private assertAssignableRoles(roles: UserRole[], actor: RequestUser): UserRole[] {
    const unique = [...new Set(roles)];
    const invalid = unique.filter((r) => !(ADMIN_ROLES as readonly UserRole[]).includes(r));
    if (invalid.length) throw AppException.validation([{ field: 'roles', message: `not staff roles: ${invalid.join(', ')}` }]);
    if (unique.includes(UserRole.SUPER_ADMIN) && !actor.isSuperAdmin) throw AppException.forbidden('Only a SUPER_ADMIN can grant SUPER_ADMIN');
    return unique;
  }

  /** Maps role names to `admin_roles.id` so `user_roles.admin_role_id` carries the permission bundle. */
  private async adminRoleIds(roles: UserRole[]): Promise<Map<UserRole, string>> {
    const rows = await this.prisma.adminRole.findMany({ where: { name: { in: roles } }, select: { id: true, name: true } });
    const map = new Map<UserRole, string>();
    for (const row of rows) map.set(row.name as UserRole, row.id);
    const missing = roles.filter((r) => !map.has(r));
    if (missing.length) throw AppException.internal(`admin_roles rows are missing for: ${missing.join(', ')} — RbacService.seedCatalogue did not run`);
    return map;
  }

  private toStaffDto(row: Parameters<UsersService['toDto']>[0] & { adminCredential: { email: string; mustChangePassword: boolean; lockedUntil: Date | null; passwordChangedAt: Date | null } | null; lastLoginAt: Date | null }): StaffUserDto {
    return {
      user: this.users.toDto(row),
      email: row.adminCredential?.email ?? null,
      mustChangePassword: row.adminCredential?.mustChangePassword ?? false,
      lockedUntil: row.adminCredential?.lockedUntil?.toISOString() ?? null,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      passwordChangedAt: row.adminCredential?.passwordChangedAt?.toISOString() ?? null,
    };
  }
}
