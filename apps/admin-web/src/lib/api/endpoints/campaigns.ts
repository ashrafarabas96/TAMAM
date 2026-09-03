import type { BannerDto, BannerPlacement, CampaignDto, CampaignStatsDto, JobType, Page } from '@tamam/shared-types';
import type { CampaignStatusActionInput, UpsertCampaignInput } from '@tamam/validation';

import { api } from '@/lib/api';

export interface CampaignPreviewInput {
  placement: BannerPlacement;
  audience?: 'CUSTOMER' | 'PARTNER';
  zoneId?: string;
  language?: 'ar' | 'en';
  platform?: 'ios' | 'android' | 'web';
  completedJobs?: number;
  isNewCustomer?: boolean;
  usedJobTypes?: JobType[];
  userId?: string;
}

export const campaignsApi = {
  list: (query: { cursor?: string; limit?: number; status?: string; q?: string }) => api.get<Page<CampaignDto>>('/admin/campaigns', query),
  get: (id: string) => api.get<CampaignDto>(`/admin/campaigns/${id}`),
  create: (input: UpsertCampaignInput) => api.post<CampaignDto>('/admin/campaigns', input),
  update: (id: string, input: UpsertCampaignInput) => api.put<CampaignDto>(`/admin/campaigns/${id}`, input),
  changeStatus: (id: string, input: CampaignStatusActionInput) => api.post<CampaignDto>(`/admin/campaigns/${id}/status`, input),
  stats: (id: string, query: { from?: string; to?: string }) => api.get<CampaignStatsDto>(`/admin/campaigns/${id}/stats`, query),
  preview: (input: CampaignPreviewInput) => api.post<BannerDto[]>('/admin/campaigns/preview', input),
};
