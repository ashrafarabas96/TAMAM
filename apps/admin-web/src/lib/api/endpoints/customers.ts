import type { Page, ReviewDto, UserDto } from '@tamam/shared-types';
import type { AccountStatusActionInput, CustomerListFilterInput } from '@tamam/validation';

import { api } from '@/lib/api';

/** ratings/ratings.service.ts → ReceivedReviewDto */
export type ReceivedReviewDto = Omit<ReviewDto, 'raterId'> & { raterName: string | null };

export const customersApi = {
  list: (filter: Partial<CustomerListFilterInput>) =>
    api.get<Page<UserDto>>('/admin/customers', { ...filter }),
  get: (id: string) => api.get<UserDto>(`/admin/users/${id}`),
  changeStatus: (id: string, input: AccountStatusActionInput) =>
    api.post<UserDto>(`/admin/users/${id}/status`, input),
  reviews: (id: string, query: { cursor?: string; limit?: number }) =>
    api.get<Page<ReceivedReviewDto>>(`/admin/users/${id}/reviews`, query),
};
