import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { type AuthTokens, CONFIG_KEYS, ErrorCode, type UserRole } from '@tamam/shared-types';
import type { DeviceInfoInput } from '@tamam/validation';
import { PinoLogger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { randomToken, sha256 } from '../../common/utils/crypto.util';
import { addSeconds } from '../../common/utils/time';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SystemConfigService } from '../config/system-config.service';

import { TokenService } from './token.service';

/**
 * Device sessions with rotating refresh tokens (spec §10):
 *  - refresh token = random 256-bit secret, stored as SHA-256 hash
 *  - every refresh rotates the secret and keeps the same `tokenFamily`
 *  - presenting an already-rotated token means theft → the whole family is revoked
 *  - max concurrent sessions per user is configurable; oldest is evicted
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sysConfig: SystemConfigService,
    private readonly audit: AuditService,
    private readonly logger: PinoLogger,
  ) {}

  async create(
    userId: string,
    roles: UserRole[],
    device: DeviceInfoInput,
    ip: string | null,
    userAgent: string | null,
    tx?: Tx,
  ): Promise<AuthTokens> {
    const client = tx ?? this.prisma;
    const [refreshTtl, maxSessions] = await Promise.all([
      this.sysConfig.getNumber(CONFIG_KEYS.AUTH_REFRESH_TTL_S),
      this.sysConfig.getNumber(CONFIG_KEYS.AUTH_MAX_DEVICE_SESSIONS),
    ]);

    // one active session per device
    await client.userSession.updateMany({
      where: { userId, deviceId: device.deviceId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'replaced_by_new_login' },
    });

    // evict oldest sessions beyond the cap
    const active = await client.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'asc' },
      select: { id: true },
    });
    if (active.length >= maxSessions) {
      const evict = active.slice(0, active.length - maxSessions + 1).map((s) => s.id);
      await client.userSession.updateMany({
        where: { id: { in: evict } },
        data: { revokedAt: new Date(), revokedReason: 'max_sessions' },
      });
      for (const id of evict) await this.tokens.markSessionRevoked(id, refreshTtl);
    }

    const refreshSecret = randomToken(32);
    const session = await client.userSession.create({
      data: {
        userId,
        deviceId: device.deviceId,
        deviceName: device.deviceName ?? null,
        platform: device.platform,
        appVersion: device.appVersion ?? null,
        refreshTokenHash: sha256(refreshSecret),
        tokenFamily: randomUUID(),
        ipAddress: ip,
        userAgent,
        expiresAt: addSeconds(new Date(), refreshTtl),
      },
    });
    const access = await this.tokens.signAccessToken(userId, session.id, device.deviceId, roles);
    return {
      accessToken: access.token,
      refreshToken: `${session.id}.${refreshSecret}`,
      accessExpiresInSeconds: access.expiresIn,
      refreshExpiresInSeconds: refreshTtl,
      tokenType: 'Bearer',
    };
  }

  async refresh(rawRefreshToken: string, deviceId: string, ip: string | null): Promise<AuthTokens> {
    const [sessionId, secret] = rawRefreshToken.split('.');
    if (!sessionId || !secret)
      throw AppException.unauthenticated('Invalid refresh token', ErrorCode.TOKEN_REVOKED);
    const refreshTtl = await this.sysConfig.getNumber(CONFIG_KEYS.AUTH_REFRESH_TTL_S);

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { roles: true } } },
    });
    if (!session)
      throw AppException.unauthenticated('Invalid refresh token', ErrorCode.TOKEN_REVOKED);
    if (session.deviceId !== deviceId)
      throw AppException.unauthenticated(
        'Refresh token does not belong to this device',
        ErrorCode.TOKEN_REVOKED,
      );

    const presentedHash = sha256(secret);
    if (session.refreshTokenHash !== presentedHash) {
      // Reuse of a rotated token → compromise: kill the whole family.
      this.logger.warn(
        { userId: session.userId, sessionId },
        'refresh token reuse detected — revoking family',
      );
      const family = await this.prisma.userSession.findMany({
        where: { tokenFamily: session.tokenFamily, revokedAt: null },
        select: { id: true },
      });
      await this.prisma.userSession.updateMany({
        where: { tokenFamily: session.tokenFamily, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'refresh_reuse_detected' },
      });
      for (const s of family) await this.tokens.markSessionRevoked(s.id, refreshTtl);
      await this.audit.record({
        actorId: session.userId,
        action: 'auth.refresh_reuse',
        entity: 'user_session',
        entityId: sessionId,
        ip,
      });
      throw AppException.unauthenticated(
        'Session revoked — please sign in again',
        ErrorCode.TOKEN_REVOKED,
      );
    }
    if (session.revokedAt || session.expiresAt < new Date())
      throw AppException.unauthenticated('Session expired', ErrorCode.TOKEN_EXPIRED);

    const newSecret = randomToken(32);
    const updated = await this.prisma.userSession.update({
      where: { id: sessionId, refreshTokenHash: presentedHash }, // optimistic: concurrent refresh loses
      data: {
        refreshTokenHash: sha256(newSecret),
        lastSeenAt: new Date(),
        ipAddress: ip ?? session.ipAddress,
        expiresAt: addSeconds(new Date(), refreshTtl),
      },
    });
    const roles = session.user.roles.map((r) => r.role);
    const access = await this.tokens.signAccessToken(session.userId, updated.id, deviceId, roles);
    return {
      accessToken: access.token,
      refreshToken: `${updated.id}.${newSecret}`,
      accessExpiresInSeconds: access.expiresIn,
      refreshExpiresInSeconds: refreshTtl,
      tokenType: 'Bearer',
    };
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt: new Date() },
    });
  }

  async revoke(userId: string, sessionId: string, reason: string): Promise<void> {
    const refreshTtl = await this.sysConfig.getNumber(CONFIG_KEYS.AUTH_REFRESH_TTL_S);
    const res = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    if (res.count === 0) throw AppException.notFound('Session', sessionId);
    await this.tokens.markSessionRevoked(sessionId, refreshTtl);
    await this.prisma.pushToken.updateMany({
      where: {
        userId,
        deviceId:
          (await this.prisma.userSession.findUnique({ where: { id: sessionId } }))?.deviceId ?? '',
      },
      data: { isActive: false },
    });
  }

  async revokeAll(userId: string, reason: string, exceptSessionId?: string): Promise<number> {
    const refreshTtl = await this.sysConfig.getNumber(CONFIG_KEYS.AUTH_REFRESH_TTL_S);
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        NOT: exceptSessionId ? { id: exceptSessionId } : undefined,
      },
      select: { id: true },
    });
    await this.prisma.userSession.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    for (const s of sessions) await this.tokens.markSessionRevoked(s.id, refreshTtl);
    if (!exceptSessionId)
      await this.prisma.pushToken.updateMany({ where: { userId }, data: { isActive: false } });
    return sessions.length;
  }

  /** Maintenance: delete sessions expired for more than 30 days. */
  async purgeExpired(): Promise<number> {
    const cutoff = addSeconds(new Date(), -30 * 86400);
    const res = await this.prisma.userSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    return res.count;
  }
}
