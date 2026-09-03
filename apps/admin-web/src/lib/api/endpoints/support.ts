import type { Page, SupportTicketDto } from '@tamam/shared-types';
import type { TicketMessageInput, UpdateTicketInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { SupportMessageDto, SupportTicketDetailDto, UserReportDto } from '@/lib/api/types';

export const supportApi = {
  list: (query: { cursor?: string; limit?: number; status?: string; priority?: string; category?: string; assignedAgentId?: string; q?: string }) => api.get<Page<SupportTicketDto>>('/admin/support/tickets', query),
  get: (id: string) => api.get<SupportTicketDetailDto>(`/admin/support/tickets/${id}`),
  update: (id: string, input: UpdateTicketInput) => api.patch<SupportTicketDto>(`/admin/support/tickets/${id}`, input),
  addMessage: (id: string, input: TicketMessageInput) => api.post<SupportMessageDto>(`/admin/support/tickets/${id}/messages`, input),
  reports: (query: { cursor?: string; limit?: number; status?: string; reportedId?: string; reporterId?: string; jobId?: string }) => api.get<Page<UserReportDto>>('/admin/support/reports', query),
};
