import type { Page } from '@tamam/shared-types';
import type {
  ChaletApprovalDecisionInput,
  ChaletApprovalQueryInput,
  ChaletSuspensionInput,
} from '@tamam/validation';

import { api } from '@/lib/api';
import type { AdminChaletDetail, AdminChaletRow } from '@/lib/api/types';

export const chaletsApi = {
  list: (filters: Partial<ChaletApprovalQueryInput>) =>
    api.get<Page<AdminChaletRow>>('/admin/chalets', filters),
  pendingCount: () => api.get<{ pending: number }>('/admin/chalets/pending-count'),
  get: (id: string) => api.get<AdminChaletDetail>(`/admin/chalets/${id}`),
  decide: (id: string, input: ChaletApprovalDecisionInput) =>
    api.patch<AdminChaletRow>(`/admin/chalets/${id}/approval`, input),
  setSuspended: (id: string, input: ChaletSuspensionInput) =>
    api.patch<AdminChaletRow>(`/admin/chalets/${id}/suspension`, input),
};
