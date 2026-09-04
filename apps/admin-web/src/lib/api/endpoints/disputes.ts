import type { Page } from '@tamam/shared-types';
import type { DecideDisputeInput, DisputeMessageInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { DisputeDetailDto, DisputeDto, DisputeMessageDto } from '@/lib/api/types';

export const disputesApi = {
  list: (query: {
    cursor?: string;
    limit?: number;
    status?: string;
    jobId?: string;
    customerId?: string;
    partnerId?: string;
  }) => api.get<Page<DisputeDto>>('/admin/disputes', query),
  get: (id: string) => api.get<DisputeDetailDto>(`/admin/disputes/${id}`),
  addMessage: (id: string, input: DisputeMessageInput) =>
    api.post<DisputeMessageDto>(`/admin/disputes/${id}/messages`, input),
  decide: (id: string, input: DecideDisputeInput, idempotencyKey: string) =>
    api.post<DisputeDto>(`/admin/disputes/${id}/decision`, input, { idempotencyKey }),
};
