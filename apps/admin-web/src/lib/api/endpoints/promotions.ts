import type { Page } from '@tamam/shared-types';
import type { UpsertPromoCodeInput, UpsertReferralProgramInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { PromoCodeDto, PromoStatsDto, ReferralProgramDto, ReferralRewardDto } from '@/lib/api/types';

export const promotionsApi = {
  list: (query: { cursor?: string; limit?: number; isActive?: boolean; q?: string }) => api.get<Page<PromoCodeDto>>('/admin/promo-codes', query),
  create: (input: UpsertPromoCodeInput) => api.post<PromoCodeDto>('/admin/promo-codes', input),
  update: (id: string, input: UpsertPromoCodeInput) => api.put<PromoCodeDto>(`/admin/promo-codes/${id}`, input),
  stats: (id: string) => api.get<PromoStatsDto>(`/admin/promo-codes/${id}/stats`),
  referralProgram: () => api.get<ReferralProgramDto | null>('/admin/referral-program'),
  upsertReferralProgram: (input: UpsertReferralProgramInput) => api.put<ReferralProgramDto>('/admin/referral-program', input),
  referralRewards: (query: { cursor?: string; limit?: number; status?: string; inviterId?: string }) => api.get<Page<ReferralRewardDto>>('/admin/referral-rewards', query),
};
