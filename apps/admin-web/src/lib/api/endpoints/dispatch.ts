import type { JobDto } from '@tamam/shared-types';
import type { ManualAssignInput, NearbyPartnersQueryInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { JobAssignmentRow, NearbyPartnerDto } from '@/lib/api/types';

export const dispatchApi = {
  nearbyPartners: (query: Partial<NearbyPartnersQueryInput> & { lat: number; lng: number }) =>
    api.get<NearbyPartnerDto[]>('/admin/dispatch/nearby-partners', { ...query }),
  assignments: (jobId: string) => api.get<JobAssignmentRow[]>(`/admin/jobs/${jobId}/assignments`),
  assign: (jobId: string, input: ManualAssignInput) =>
    api.post<JobDto>(`/admin/jobs/${jobId}/assign`, input),
  redispatch: (jobId: string) => api.post<{ ok: true }>(`/admin/jobs/${jobId}/redispatch`),
};
