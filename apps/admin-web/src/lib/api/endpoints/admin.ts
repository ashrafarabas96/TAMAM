import type { Page, UserDto } from '@tamam/shared-types';
import type { AccountStatusActionInput, CreateAdminUserInput, DispatcherJobsFilterInput, UpdateAdminRolesInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { AdminOverviewDto, AdminSearchResult, DispatchConsoleRow, PartnerTimelineDto, StaffUserDto, TemporaryPasswordResult } from '@/lib/api/types';

export const adminApi = {
  overview: () => api.get<AdminOverviewDto>('/admin/overview'),
  search: (q: string, signal?: AbortSignal) => api.get<AdminSearchResult>('/admin/search', { q }, { signal }),
  dispatchConsole: (filter: Partial<DispatcherJobsFilterInput>) => api.get<Page<DispatchConsoleRow>>('/admin/dispatch/console', { ...filter }),
  partnerTimeline: (partnerId: string) => api.get<PartnerTimelineDto>(`/admin/dispatch/partners/${partnerId}/timeline`),
  staffList: (query: { cursor?: string; limit?: number; q?: string; role?: string }) => api.get<Page<StaffUserDto>>('/admin/staff', query),
  staffGet: (id: string) => api.get<StaffUserDto>(`/admin/staff/${id}`),
  staffCreate: (input: CreateAdminUserInput) => api.post<StaffUserDto>('/admin/staff', input),
  staffUpdateRoles: (id: string, input: UpdateAdminRolesInput) => api.patch<StaffUserDto>(`/admin/staff/${id}/roles`, input),
  staffResetPassword: (id: string, reason: string) => api.post<TemporaryPasswordResult>(`/admin/staff/${id}/reset-password`, { reason }),
  staffChangeStatus: (id: string, input: AccountStatusActionInput) => api.post<UserDto>(`/admin/staff/${id}/status`, input),
};
