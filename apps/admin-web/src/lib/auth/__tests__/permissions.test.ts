import { describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, Permission, UserRole } from '@tamam/shared-types';

import { createPermissionChecker, NO_PERMISSIONS, permissionsForRoles } from '../permissions';

describe('permissions helper', () => {
  it('gives a SUPER_ADMIN every permission', () => {
    const set = permissionsForRoles([UserRole.SUPER_ADMIN]);
    expect(set.size).toBe(ALL_PERMISSIONS.length);
    expect(set.has(Permission.REFUNDS_ISSUE)).toBe(true);
  });

  it('derives the bundle of a delegated role', () => {
    const dispatcher = permissionsForRoles([UserRole.DISPATCHER]);
    expect(dispatcher.has(Permission.DISPATCH_MANUAL_ASSIGN)).toBe(true);
    expect(dispatcher.has(Permission.REFUNDS_ISSUE)).toBe(false);
  });

  it('unions several roles', () => {
    const set = permissionsForRoles([UserRole.DISPATCHER, UserRole.FINANCE]);
    expect(set.has(Permission.DISPATCH_MANUAL_ASSIGN)).toBe(true);
    expect(set.has(Permission.REFUNDS_ISSUE)).toBe(true);
  });

  it('prefers the explicit permission list from the API when present', () => {
    const set = permissionsForRoles([UserRole.DISPATCHER], [Permission.AUDIT_READ]);
    expect(set.has(Permission.AUDIT_READ)).toBe(true);
    expect(set.has(Permission.DISPATCH_MANUAL_ASSIGN)).toBe(false);
  });

  it('answers can / canAny / canAll', () => {
    const checker = createPermissionChecker(new Set([Permission.JOBS_READ_ALL, Permission.PARTNERS_READ]));
    expect(checker.can(Permission.JOBS_READ_ALL)).toBe(true);
    expect(checker.can(Permission.JOBS_CANCEL)).toBe(false);
    expect(checker.canAny(Permission.JOBS_CANCEL, Permission.PARTNERS_READ)).toBe(true);
    expect(checker.canAll(Permission.JOBS_READ_ALL, Permission.JOBS_CANCEL)).toBe(false);
    // An empty requirement means "no permission needed".
    expect(checker.canAny()).toBe(true);
  });

  it('treats an unknown role as granting nothing', () => {
    expect(permissionsForRoles(['NOT_A_ROLE']).size).toBe(0);
    expect(NO_PERMISSIONS.can(Permission.AUDIT_READ)).toBe(false);
  });
});
