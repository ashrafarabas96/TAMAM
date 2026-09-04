import type { LiveMapJobDto, LiveMapPartnerDto } from '@tamam/shared-types';
import type { LiveMapQueryInput } from '@tamam/validation';

import { api } from '@/lib/api';

export const trackingApi = {
  liveMap: (query: Partial<LiveMapQueryInput>) =>
    api.get<{ partners: LiveMapPartnerDto[]; jobs: LiveMapJobDto[] }>('/admin/live-map', {
      ...query,
    }),
};
