import type { ChatMessageDto, JobDto, JobEventDto, Page } from '@tamam/shared-types';
import type { AdminTransitionInput, JobListFilterInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { SosAlertRow } from '@/lib/api/types';

export const jobsApi = {
  list: (filter: Partial<JobListFilterInput> & { cursor?: string; limit?: number }) =>
    api.get<Page<JobDto>>('/admin/jobs', { ...filter }),
  get: (id: string) => api.get<JobDto>(`/admin/jobs/${id}`),
  timeline: (id: string) => api.get<JobEventDto[]>(`/jobs/${id}/timeline`),
  transition: (id: string, input: AdminTransitionInput) =>
    api.post<JobDto>(`/admin/jobs/${id}/transition`, input),
  chatMessages: (id: string, query: { cursor?: string; limit?: number }) =>
    api.get<Page<ChatMessageDto>>(`/jobs/${id}/chat/messages`, query),
  sosList: () => api.get<SosAlertRow[]>('/admin/sos'),
  sosAcknowledge: (id: string) => api.post<{ ok: true }>(`/admin/sos/${id}/acknowledge`),
  sosResolve: (id: string) => api.post<{ ok: true }>(`/admin/sos/${id}/resolve`),
};
