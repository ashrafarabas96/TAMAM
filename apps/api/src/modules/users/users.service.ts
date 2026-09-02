import { Injectable } from '@nestjs/common';
import { AccountStatus, type DeviceSessionDto, type Page, type UserDto, UserRole } from '@tamam/shared-types';
import type { AccountStatusActionInput, CustomerListFilterInput, UpdateProfileInput, UpdatePushTokenInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { randomReferralCode } from '../../common/utils/crypto.util';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MediaUrlService } from '../media/media-url.service';

const userInclude = {
  roles: true,
  profileImage: true,
  customer: true,
  partner: { include: { roles: true, availability: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  async findById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user || user.deletedAt) throw AppException.notFound('User', id);
    return this.toDto(user);
  }

  /** Creates a customer or partner identity on first OTP verification. */
  async createFromPhone(phone: string, audience: 'CUSTOMER' | 'PARTNER', language: 'ar' | 'en', referralCode: string | undefined, tx: Tx) {
    const referredBy = referralCode ? await tx.customerProfile.findUnique({ where: { referralCode: referralCode.toUpperCase() } }) : null;
    const user = await tx.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        language,
        roles: { create: [{ role: audience === 'PARTNER' ? UserRole.PARTNER : UserRole.CUSTOMER }] },
        customer: audience === 'CUSTOMER' ? { create: { referralCode: await this.uniqueReferralCode(tx), referredById: referredBy?.userId ?? null } } : undefined,
        partner: audience === 'PARTNER' ? { create: { availability: { create: {} } } } : undefined,
        notificationPreference: { create: {} },
      },
      include: userInclude,
    });
    return user;
  }

  /** A partner who later opens the customer app (or vice-versa) gets the additional role/profile. */
  async ensureRole(userId: string, audience: 'CUSTOMER' | 'PARTNER', tx: Tx): Promise<void> {
    const role = audience === 'PARTNER' ? UserRole.PARTNER : UserRole.CUSTOMER;
    await tx.userRoleAssignment.upsert({ where: { userId_role: { userId, role } }, update: {}, create: { userId, role } });
    if (audience === 'CUSTOMER') {
      const exists = await tx.customerProfile.findUnique({ where: { userId } });
      if (!exists) await tx.customerProfile.create({ data: { userId, referralCode: await this.uniqueReferralCode(tx) } });
    } else {
      const exists = await tx.partnerProfile.findUnique({ where: { userId } });
      if (!exists) await tx.partnerProfile.create({ data: { userId, availability: { create: {} } } });
    }
  }

  private async uniqueReferralCode(tx: Tx): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const code = randomReferralCode(8);
      const clash = await tx.customerProfile.findUnique({ where: { referralCode: code } });
      if (!clash) return code;
    }
    throw AppException.internal('could not allocate referral code');
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    if (input.email) {
      const clash = await this.prisma.user.findFirst({ where: { email: input.email, NOT: { id: userId } } });
      if (clash) throw AppException.conflict('Email already in use');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: input.fullName, email: input.email, language: input.language, profileImageId: input.profileImageMediaId },
      include: userInclude,
    });
    return this.toDto(user);
  }

  async upsertPushToken(userId: string, input: UpdatePushTokenInput): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { userId_deviceId: { userId, deviceId: input.deviceId } },
      update: { token: input.pushToken, platform: input.platform, isActive: true, lastUsedAt: new Date() },
      create: { userId, deviceId: input.deviceId, token: input.pushToken, platform: input.platform },
    });
  }

  async listSessions(userId: string, currentSessionId: string): Promise<DeviceSessionDto[]> {
    const rows = await this.prisma.userSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' } });
    return rows.map((s) => ({ id: s.id, deviceId: s.deviceId, deviceName: s.deviceName, platform: s.platform, appVersion: s.appVersion, lastSeenAt: s.lastSeenAt.toISOString(), createdAt: s.createdAt.toISOString(), current: s.id === currentSessionId }));
  }

  /* -------------------------------------------------------------- admin */
  async listCustomers(filter: CustomerListFilterInput): Promise<Page<UserDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.user.findMany({
      where: {
        ...cursorWhere(cursor),
        roles: { some: { role: UserRole.CUSTOMER } },
        accountStatus: filter.status,
        createdAt: filter.from || filter.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined,
        OR: filter.q ? [{ phone: { contains: filter.q } }, { fullName: { contains: filter.q, mode: 'insensitive' } }, { email: { contains: filter.q, mode: 'insensitive' } }] : undefined,
      },
      include: userInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (u) => this.toDto(u));
  }

  async changeAccountStatus(targetId: string, input: AccountStatusActionInput, actorId: string, requestId: string | null): Promise<UserDto> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: { roles: true } });
    if (!target) throw AppException.notFound('User', targetId);
    if (target.roles.some((r) => r.role === UserRole.SUPER_ADMIN)) throw AppException.forbidden('Cannot change status of a super admin');
    const next: AccountStatus =
      input.action === 'RESTRICT' ? AccountStatus.RESTRICTED
      : input.action === 'SUSPEND' ? AccountStatus.SUSPENDED
      : input.action === 'SOFT_DELETE' ? AccountStatus.DELETED
      : AccountStatus.ACTIVE;
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: { accountStatus: next, statusReason: input.reason, statusUntil: input.until ? new Date(input.until) : null, deletedAt: next === AccountStatus.DELETED ? new Date() : null },
        include: userInclude,
      });
      if (next !== AccountStatus.ACTIVE) {
        await tx.userSession.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: `account_${next.toLowerCase()}` } });
      }
      await this.audit.record({ actorId, action: `user.${input.action.toLowerCase()}`, entity: 'user', entityId: targetId, oldValue: { accountStatus: target.accountStatus }, newValue: { accountStatus: next, until: input.until ?? null }, reason: input.reason, requestId }, tx);
      return updated;
    });
    return this.toDto(user);
  }

  /* ------------------------------------------------------------ mapping */
  toDto(user: {
    id: string; phone: string; email: string | null; fullName: string | null; language: string; currency: string; accountStatus: AccountStatus; createdAt: Date;
    profileImage: { bucket: string; objectKey: string; isPublic: boolean; mediumKey: string | null } | null;
    roles: Array<{ role: UserRole }>;
    customer: { ratingSum: number; ratingCount: number; completedJobs: number; cancelledJobs: number; referralCode: string } | null;
    partner: { userId: string; verificationStatus: string; ratingSum: number; ratingCount: number; completedJobs: number; offersReceived: number; offersAccepted: number; cancelledJobs: number; roles: Array<{ role: string; isActive: boolean }>; availability: { status: string } | null } | null;
  }): UserDto {
    const customer = user.customer;
    const partner = user.partner;
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      profileImageUrl: user.profileImage ? this.mediaUrls.urlFor(user.profileImage) : null,
      language: user.language as UserDto['language'],
      currency: user.currency,
      roles: user.roles.map((r) => r.role),
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
      customer: customer
        ? { rating: customer.ratingCount ? Number((customer.ratingSum / customer.ratingCount).toFixed(2)) : 5, ratingCount: customer.ratingCount, completedJobs: customer.completedJobs, cancelledJobs: customer.cancelledJobs, referralCode: customer.referralCode }
        : undefined,
      partner: partner
        ? {
            id: partner.userId,
            verificationStatus: partner.verificationStatus as UserDto['partner'] extends infer P ? (P extends { verificationStatus: infer V } ? V : never) : never,
            availability: (partner.availability?.status ?? 'OFFLINE') as NonNullable<UserDto['partner']>['availability'],
            roles: partner.roles.filter((r) => r.isActive).map((r) => r.role as NonNullable<UserDto['partner']>['roles'][number]),
            rating: partner.ratingCount ? Number((partner.ratingSum / partner.ratingCount).toFixed(2)) : 5,
            ratingCount: partner.ratingCount,
            completedJobs: partner.completedJobs,
            acceptanceRate: partner.offersReceived ? Number((partner.offersAccepted / partner.offersReceived).toFixed(3)) : 1,
            cancellationRate: partner.completedJobs + partner.cancelledJobs ? Number((partner.cancelledJobs / (partner.completedJobs + partner.cancelledJobs)).toFixed(3)) : 0,
          }
        : undefined,
    };
  }
}
