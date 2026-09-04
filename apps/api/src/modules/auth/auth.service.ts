import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  type AuthSession,
  type AuthTokens,
  ErrorCode,
  UserRole,
} from '@tamam/shared-types';
import type {
  AdminChangePasswordInput,
  AdminLoginInput,
  RefreshTokenInput,
  RequestOtpInput,
  VerifyOtpInput,
} from '@tamam/validation';
import argon2 from 'argon2';

import { AppException } from '../../common/errors/app.exception';
import { normalizePhone } from '../../common/utils/phone';
import { addMinutes } from '../../common/utils/time';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};
const ADMIN_LOCK_AFTER = 5;
const ADMIN_LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async requestOtp(input: RequestOtpInput, ip: string | null, deviceId: string | null) {
    const phone = normalizePhone(input.phone);
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { accountStatus: true },
    });
    if (
      existing?.accountStatus === AccountStatus.SUSPENDED ||
      existing?.accountStatus === AccountStatus.DELETED
    ) {
      // Do not reveal account state through OTP; respond as if sent but do nothing.
      return { resendAfterSeconds: 45, expiresInSeconds: 300 };
    }
    return this.otp.request(phone, input.audience, input.language, ip, deviceId);
  }

  async verifyOtp(
    input: VerifyOtpInput,
    ip: string | null,
    userAgent: string | null,
  ): Promise<AuthSession> {
    const phone = normalizePhone(input.phone);
    const { audience } = await this.otp.verify(phone, input.code);
    if (audience !== input.audience)
      throw new AppException(ErrorCode.OTP_INVALID, 'Code was issued for a different app', 400);

    const { user, isNewUser, tokens } = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { phone }, include: { roles: true } });
      let isNewUser = false;
      if (!user) {
        const created = await this.users.createFromPhone(
          phone,
          audience,
          input.language,
          input.referralCode,
          tx,
        );
        user = { ...created, roles: created.roles };
        isNewUser = true;
      } else {
        if (user.accountStatus === AccountStatus.SUSPENDED)
          throw AppException.forbidden('Your account is suspended', ErrorCode.ACCOUNT_SUSPENDED);
        if (user.accountStatus === AccountStatus.DELETED)
          throw AppException.forbidden('Account no longer exists');
        await this.users.ensureRole(user.id, audience, tx);
        await tx.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
            language: input.language,
          },
        });
        user = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: { roles: true },
        });
      }
      const tokens = await this.sessions.create(
        user.id,
        user.roles.map((r) => r.role),
        input.device,
        ip,
        userAgent,
        tx,
      );
      if (input.device.pushToken) {
        await tx.pushToken.upsert({
          where: { userId_deviceId: { userId: user.id, deviceId: input.device.deviceId } },
          update: {
            token: input.device.pushToken,
            platform:
              input.device.platform === 'web'
                ? 'web'
                : input.device.platform === 'ios'
                  ? 'ios'
                  : 'android',
            isActive: true,
          },
          create: {
            userId: user.id,
            deviceId: input.device.deviceId,
            token: input.device.pushToken,
            platform:
              input.device.platform === 'web'
                ? 'web'
                : input.device.platform === 'ios'
                  ? 'ios'
                  : 'android',
          },
        });
      }
      return { user, isNewUser, tokens };
    });

    await this.audit.record({
      actorId: user.id,
      action: isNewUser ? 'auth.signup' : 'auth.login',
      entity: 'user',
      entityId: user.id,
      ip,
      userAgent,
      newValue: { audience, deviceId: input.device.deviceId },
    });
    return { tokens, user: await this.users.findById(user.id), isNewUser };
  }

  refresh(input: RefreshTokenInput, ip: string | null): Promise<AuthTokens> {
    return this.sessions.refresh(input.refreshToken, input.device.deviceId, ip);
  }

  async logout(userId: string, sessionId: string, all: boolean): Promise<{ revoked: number }> {
    if (all) return { revoked: await this.sessions.revokeAll(userId, 'user_logout_all') };
    await this.sessions.revoke(userId, sessionId, 'user_logout');
    return { revoked: 1 };
  }

  /* -------------------------------------------------------------- admin */
  async adminLogin(
    input: AdminLoginInput,
    ip: string | null,
    userAgent: string | null,
  ): Promise<AuthSession> {
    const cred = await this.prisma.adminCredential.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { user: { include: { roles: true } } },
    });
    // constant-time-ish: always run a hash verify so timing does not reveal account existence
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = cred
      ? await argon2.verify(cred.passwordHash, input.password).catch(() => false)
      : await argon2.verify(dummyHash, input.password).catch(() => false);

    if (
      !cred ||
      !cred.user.roles.some((r) => r.role !== UserRole.CUSTOMER && r.role !== UserRole.PARTNER)
    ) {
      throw AppException.unauthenticated('Invalid email or password');
    }
    if (cred.lockedUntil && cred.lockedUntil > new Date()) {
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        'Account temporarily locked. Try again later.',
        429,
        { retryAfterSeconds: Math.ceil((cred.lockedUntil.getTime() - Date.now()) / 1000) },
      );
    }
    if (!ok) {
      const attempts = cred.failedAttempts + 1;
      await this.prisma.adminCredential.update({
        where: { userId: cred.userId },
        data: {
          failedAttempts: attempts,
          lockedUntil:
            attempts >= ADMIN_LOCK_AFTER ? addMinutes(new Date(), ADMIN_LOCK_MINUTES) : null,
        },
      });
      await this.audit.record({
        actorId: cred.userId,
        action: 'auth.admin_login_failed',
        entity: 'user',
        entityId: cred.userId,
        ip,
        userAgent,
      });
      throw AppException.unauthenticated('Invalid email or password');
    }
    if (cred.user.accountStatus !== AccountStatus.ACTIVE)
      throw AppException.forbidden('Account is not active', ErrorCode.ACCOUNT_SUSPENDED);

    await this.prisma.adminCredential.update({
      where: { userId: cred.userId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    await this.prisma.user.update({
      where: { id: cred.userId },
      data: { lastLoginAt: new Date() },
    });
    const device = input.device?.deviceId
      ? {
          deviceId: input.device.deviceId,
          deviceName: input.device.deviceName,
          platform: 'web' as const,
          appVersion: input.device.appVersion,
        }
      : { deviceId: `web-${cred.userId.slice(0, 8)}`, platform: 'web' as const };
    const tokens = await this.sessions.create(
      cred.userId,
      cred.user.roles.map((r) => r.role),
      device,
      ip,
      userAgent,
    );
    await this.audit.record({
      actorId: cred.userId,
      action: 'auth.admin_login',
      entity: 'user',
      entityId: cred.userId,
      ip,
      userAgent,
    });
    return { tokens, user: await this.users.findById(cred.userId), isNewUser: false };
  }

  async adminChangePassword(
    userId: string,
    sessionId: string,
    input: AdminChangePasswordInput,
    ip: string | null,
  ): Promise<void> {
    const cred = await this.prisma.adminCredential.findUnique({ where: { userId } });
    if (!cred) throw AppException.notFound('Admin credential');
    const ok = await argon2.verify(cred.passwordHash, input.currentPassword).catch(() => false);
    if (!ok) throw AppException.unauthenticated('Current password is incorrect');
    await this.prisma.adminCredential.update({
      where: { userId },
      data: {
        passwordHash: await argon2.hash(input.newPassword, ARGON_OPTIONS),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
    await this.sessions.revokeAll(userId, 'password_changed', sessionId);
    await this.audit.record({
      actorId: userId,
      action: 'auth.password_changed',
      entity: 'user',
      entityId: userId,
      ip,
    });
  }

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }
}
