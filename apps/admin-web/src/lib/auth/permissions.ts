import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
  UserRole,
} from '@tamam/shared-types';

/**
 * The console is permission-driven, never role-driven. The API resolves effective permissions
 * for the JWT principal; until `GET /me` exposes that list, the client derives the same set from
 * the seeded role bundles (SUPER_ADMIN implicitly holds every permission — same rule as the guard).
 */
export function permissionsForRoles(
  roles: readonly string[],
  explicit?: readonly string[] | null,
): ReadonlySet<Permission> {
  if (explicit && explicit.length > 0) return new Set(explicit as Permission[]);
  const set = new Set<Permission>();
  for (const role of roles) {
    if (role === UserRole.SUPER_ADMIN) return new Set(ALL_PERMISSIONS);
    const bundle = (DEFAULT_ROLE_PERMISSIONS as Record<string, readonly Permission[] | undefined>)[
      role
    ];
    if (bundle) for (const p of bundle) set.add(p);
  }
  return set;
}

export interface PermissionChecker {
  /** True when the user holds the permission. */
  can(permission: Permission): boolean;
  /** True when the user holds at least one of the permissions. */
  canAny(...permissions: Permission[]): boolean;
  /** True when the user holds all of the permissions. */
  canAll(...permissions: Permission[]): boolean;
  readonly permissions: ReadonlySet<Permission>;
}

export function createPermissionChecker(permissions: ReadonlySet<Permission>): PermissionChecker {
  return {
    permissions,
    can: (p) => permissions.has(p),
    canAny: (...list) => list.length === 0 || list.some((p) => permissions.has(p)),
    canAll: (...list) => list.every((p) => permissions.has(p)),
  };
}

export const NO_PERMISSIONS: PermissionChecker = createPermissionChecker(new Set());
