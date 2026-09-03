import type { FeatureFlagDto, SystemConfigDto } from '@tamam/shared-types';
import type { UpdateConfigInput, UpdateFeatureFlagInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { QueueCountsDto } from '@/lib/api/types';

export const configApi = {
  list: () => api.get<SystemConfigDto[]>('/admin/config'),
  update: (input: UpdateConfigInput) => api.patch<SystemConfigDto>('/admin/config', input),
  flags: () => api.get<FeatureFlagDto[]>('/admin/feature-flags'),
  updateFlag: (key: string, input: UpdateFeatureFlagInput) => api.patch<FeatureFlagDto>(`/admin/feature-flags/${key}`, input),
  queues: () => api.get<QueueCountsDto[]>('/admin/maintenance/queues'),
  runMaintenance: (job: string, input: { reason: string; date?: string }) => api.post<{ queued: boolean; job: string; jobId: string }>(`/admin/maintenance/run/${job}`, input),
};
