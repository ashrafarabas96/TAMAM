import type { DeviceSessionDto, UserDto } from '@tamam/shared-types';
import type { AdminChangePasswordInput } from '@tamam/validation';

import { api } from '@/lib/api';

export const authApi = {
  me: () => api.get<UserDto & { permissions?: string[] }>('/me'),
  changePassword: (input: AdminChangePasswordInput) =>
    api.post<{ ok: true }>('/auth/admin/change-password', input),
  sessions: () => api.get<DeviceSessionDto[]>('/me/sessions'),
  revokeSession: (id: string) => api.delete<{ ok: true }>(`/me/sessions/${id}`),
};
