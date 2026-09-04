import type { ServiceZoneDto } from '@tamam/shared-types';
import type { UpsertServiceZoneInput, ZoneServiceRuleInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { ZoneServiceRuleRow } from '@/lib/api/types';

export const zonesApi = {
  list: () => api.get<ServiceZoneDto[]>('/admin/zones'),
  get: (id: string) => api.get<ServiceZoneDto>(`/admin/zones/${id}`),
  create: (input: UpsertServiceZoneInput) => api.post<ServiceZoneDto>('/admin/zones', input),
  update: (id: string, input: UpsertServiceZoneInput) =>
    api.put<ServiceZoneDto>(`/admin/zones/${id}`, input),
  rules: (id: string) => api.get<ZoneServiceRuleRow[]>(`/admin/zones/${id}/rules`),
  upsertRule: (input: ZoneServiceRuleInput) =>
    api.put<ZoneServiceRuleRow>('/admin/zones/rules', input),
};
