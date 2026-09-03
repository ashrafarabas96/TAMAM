import type { SurgeOverrideInput, UpsertCancellationPolicyInput, UpsertPricingRuleInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { CancellationPolicyRow, PricingRuleRow, SurgeOverrideRow } from '@/lib/api/types';

export const pricingApi = {
  rules: (query: { jobType?: string; zoneId?: string }) => api.get<PricingRuleRow[]>('/admin/pricing/rules', query),
  createRule: (input: UpsertPricingRuleInput) => api.post<PricingRuleRow>('/admin/pricing/rules', input),
  updateRule: (id: string, input: UpsertPricingRuleInput) => api.put<PricingRuleRow>(`/admin/pricing/rules/${id}`, input),
  surge: (query: { zoneId?: string }) => api.get<SurgeOverrideRow[]>('/admin/pricing/surge', query),
  createSurge: (input: SurgeOverrideInput) => api.post<SurgeOverrideRow>('/admin/pricing/surge', input),
  endSurge: (id: string) => api.delete<SurgeOverrideRow>(`/admin/pricing/surge/${id}`),
  cancellationPolicies: () => api.get<CancellationPolicyRow[]>('/admin/pricing/cancellation-policies'),
  createCancellationPolicy: (input: UpsertCancellationPolicyInput) => api.post<CancellationPolicyRow>('/admin/pricing/cancellation-policies', input),
  updateCancellationPolicy: (id: string, input: UpsertCancellationPolicyInput) => api.put<CancellationPolicyRow>(`/admin/pricing/cancellation-policies/${id}`, input),
};
