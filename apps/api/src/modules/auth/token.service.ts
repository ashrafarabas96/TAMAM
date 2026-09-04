import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { type AccountStatus, CONFIG_KEYS, type UserRole } from '@tamam/shared-types';
import jwt from 'jsonwebtoken';

import type { AccessTokenClaims, RequestUser } from '../../common/types/request-user';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemConfigService } from '../config/system-config.service';
import { RbacService } from '../rbac/rbac.service';

const PRINCIPAL_TTL = 30; // seconds of Redis caching for the resolved principal
const SESSION_REVOKED_PREFIX = 'sess:revoked:';

/** Issues/verifies access tokens and resolves the request principal with revocation checks. */
@Injectable()
export class TokenService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rbac: RbacService,
    private readonly sysConfig: SystemConfigService,
  ) {}

  async signAccessToken(
    userId: string,
    sessionId: string,
    deviceId: string,
    roles: UserRole[],
  ): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = await this.sysConfig.getNumber(CONFIG_KEYS.AUTH_ACCESS_TTL_S);
    const token = jwt.sign(
      { sub: userId, sid: sessionId, did: deviceId, roles },
      this.config.env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn,
        issuer: this.config.env.JWT_ISSUER,
        jwtid: randomUUID(),
      },
    );
    return { token, expiresIn };
  }

  verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      return jwt.verify(token, this.config.env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: this.config.env.JWT_ISSUER,
      }) as AccessTokenClaims;
    } catch {
      return null;
    }
  }

  /** Marks a session as revoked in Redis so access tokens die immediately (not at expiry). */
  async markSessionRevoked(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.redis.client.set(
      `${SESSION_REVOKED_PREFIX}${sessionId}`,
      '1',
      'EX',
      Math.max(60, ttlSeconds),
    );
    await this.redis.del(`principal:${sessionId}`);
  }

  async invalidatePrincipalCache(userId: string): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    if (sessions.length) await this.redis.del(...sessions.map((s) => `principal:${s.id}`));
  }

  /** Full principal for guards: roles, permissions, account status, profile ids. */
  async resolvePrincipal(token: string): Promise<RequestUser | null> {
    const claims = this.verifyAccessToken(token);
    if (!claims) return null;
    if (await this.redis.client.exists(`${SESSION_REVOKED_PREFIX}${claims.sid}`)) return null;

    const cached = await this.redis.getJson<RequestUser>(`principal:${claims.sid}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: {
        roles: true,
        customer: { select: { userId: true } },
        partner: { select: { userId: true } },
        sessions: {
          where: { id: claims.sid },
          select: { id: true, deviceId: true, revokedAt: true, expiresAt: true },
        },
      },
    });
    if (!user) return null;
    const session = user.sessions[0];
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

    const roles = user.roles.map((r) => r.role);
    const permissions = await this.rbac.permissionsForRoles(roles);
    const principal: RequestUser = {
      id: user.id,
      phone: user.phone,
      roles,
      permissions,
      accountStatus: user.accountStatus as AccountStatus,
      sessionId: session.id,
      deviceId: session.deviceId,
      language: user.language === 'en' ? 'en' : 'ar',
      partnerId: user.partner?.userId,
      customerId: user.customer?.userId,
      isSuperAdmin: roles.includes('SUPER_ADMIN' as UserRole),
    };
    await this.redis.setJson(`principal:${claims.sid}`, principal, PRINCIPAL_TTL);
    return principal;
  }
}
