import type { Page } from '@tamam/shared-types';
import type { UpsertRestrictionInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { RestrictionDto, RiskSignalDto } from '@/lib/api/types';

export const riskApi = {
  signals: (query: {
    cursor?: string;
    limit?: number;
    userId?: string;
    signal?: string;
    unreviewed?: boolean;
  }) => api.get<Page<RiskSignalDto>>('/admin/risk/signals', query),
  reviewSignal: (id: string) => api.post<RiskSignalDto>(`/admin/risk/signals/${id}/review`),
  restrictions: (query: {
    cursor?: string;
    limit?: number;
    targetType?: string;
    targetId?: string;
    kind?: string;
    activeOnly?: boolean;
  }) => api.get<Page<RestrictionDto>>('/admin/risk/restrictions', query),
  createRestriction: (input: UpsertRestrictionInput) =>
    api.post<RestrictionDto>('/admin/risk/restrictions', input),
  liftRestriction: (id: string, reason: string) =>
    api.post<RestrictionDto>(`/admin/risk/restrictions/${id}/lift`, { reason }),
};
