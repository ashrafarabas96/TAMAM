import type { AccountStatus, Permission, UserRole } from '@tamam/shared-types';

/** Authenticated principal attached to every request by JwtAuthGuard. */
export interface RequestUser {
  id: string;
  phone: string;
  roles: UserRole[];
  permissions: Permission[];
  accountStatus: AccountStatus;
  sessionId: string;
  deviceId: string;
  language: 'ar' | 'en';
  /** Present when the user has a partner profile. */
  partnerId?: string;
  /** Present when the user has a customer profile. */
  customerId?: string;
  isSuperAdmin: boolean;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string; // session id
  did: string; // device id
  roles: UserRole[];
  iat: number;
  exp: number;
  iss: string;
  jti: string;
}

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  user: RequestUser | null;
}
