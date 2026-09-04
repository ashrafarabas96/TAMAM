import type { Page, PartnerDocumentDto, PartnerDto, VehicleDto } from '@tamam/shared-types';
import type {
  AdminUpdatePartnerInput,
  PartnerDecisionInput,
  PartnerListFilterInput,
  ReviewDocumentInput,
} from '@tamam/validation';

import { api } from '@/lib/api';

export const partnersApi = {
  list: (filter: Partial<PartnerListFilterInput> & { cursor?: string; limit?: number }) =>
    api.get<Page<PartnerDto>>('/admin/partners', { ...filter }),
  get: (id: string) => api.get<PartnerDto>(`/admin/partners/${id}`),
  reviewDocument: (partnerId: string, docId: string, input: ReviewDocumentInput) =>
    api.post<PartnerDocumentDto>(`/admin/partners/${partnerId}/documents/${docId}/review`, input),
  decide: (id: string, input: PartnerDecisionInput) =>
    api.post<PartnerDto>(`/admin/partners/${id}/decision`, input),
  update: (id: string, input: AdminUpdatePartnerInput) =>
    api.patch<PartnerDto>(`/admin/partners/${id}`, input),
  vehicles: (query: { partnerId?: string; status?: string; cursor?: string; limit?: number }) =>
    api.get<Page<VehicleDto>>('/admin/vehicles', query),
  vehicle: (id: string) => api.get<VehicleDto>(`/admin/vehicles/${id}`),
  reviewVehicle: (id: string, input: ReviewDocumentInput) =>
    api.post<VehicleDto>(`/admin/vehicles/${id}/review`, input),
  reviewVehicleDocument: (id: string, docId: string, input: ReviewDocumentInput) =>
    api.post<PartnerDocumentDto>(`/admin/vehicles/${id}/documents/${docId}/review`, input),
};
