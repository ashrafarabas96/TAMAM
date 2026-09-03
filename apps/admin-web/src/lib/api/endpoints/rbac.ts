import type { UpsertRoleInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { PermissionCatalogEntry, RoleDto } from '@/lib/api/types';

export const rbacApi = {
  roles: () => api.get<RoleDto[]>('/admin/rbac/roles'),
  permissions: () => api.get<PermissionCatalogEntry[]>('/admin/rbac/permissions'),
  upsertRole: (input: UpsertRoleInput) => api.put<RoleDto>('/admin/rbac/roles', input),
};
