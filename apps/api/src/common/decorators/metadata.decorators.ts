import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@tamam/shared-types';

export const IS_PUBLIC_KEY = 'tamam:public';
/** Skip authentication entirely (OTP request, health, webhooks with their own signature checks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'tamam:permissions';
/** Require ALL listed permissions. SUPER_ADMIN passes implicitly. */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ANY_PERMISSION_KEY = 'tamam:any-permission';
/** Require at least ONE of the listed permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);

export const ROLES_KEY = 'tamam:roles';
/** Coarse role gate (CUSTOMER / PARTNER endpoints). Fine-grained checks stay in policies. */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const IDEMPOTENT_KEY = 'tamam:idempotent';
/** Marks an endpoint as requiring the Idempotency-Key header (spec §102). */
export const Idempotent = (scope: string) => SetMetadata(IDEMPOTENT_KEY, scope);

export const RATE_LIMIT_KEY = 'tamam:rate-limit';
export interface RateLimitPolicy {
  /** Policy name for metrics, e.g. "otp" */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Key strategy: per authenticated user, per IP, or per body field (e.g. phone). */
  keyBy: 'user' | 'ip' | 'user-or-ip' | { body: string };
}
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_KEY, policy);

export const ALLOW_RESTRICTED_KEY = 'tamam:allow-restricted';
/** Lets RESTRICTED accounts reach read-only endpoints (profile, history, support). */
export const AllowRestricted = () => SetMetadata(ALLOW_RESTRICTED_KEY, true);

export const AUDIT_KEY = 'tamam:audit';
export interface AuditMeta {
  action: string;
  entity: string;
  /** Route param or body field carrying the entity id. */
  entityIdFrom?: string;
  sensitive?: boolean;
}
/** Automatically writes an audit log entry after a successful admin mutation. */
export const Audited = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
