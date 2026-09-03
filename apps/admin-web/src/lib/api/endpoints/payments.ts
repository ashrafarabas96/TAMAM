import type { Page, PaymentDto } from '@tamam/shared-types';
import type { IssueRefundInput, WalletAdjustmentInput, WithdrawalDecisionInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { RefundDto, WithdrawalDto } from '@/lib/api/types';

export const paymentsApi = {
  list: (query: { cursor?: string; limit?: number; jobId?: string; customerId?: string; status?: string; method?: string; from?: string; to?: string }) => api.get<Page<PaymentDto>>('/admin/payments', query),
  get: (id: string) => api.get<PaymentDto>(`/admin/payments/${id}`),
  refunds: (query: { cursor?: string; limit?: number; paymentId?: string; disputeId?: string; status?: string; from?: string; to?: string }) => api.get<Page<RefundDto>>('/admin/refunds', query),
  issueRefund: (input: IssueRefundInput, idempotencyKey: string) => api.post<RefundDto>('/admin/refunds', input, { idempotencyKey }),
  adjustWallet: (input: WalletAdjustmentInput) => api.post<unknown>('/admin/wallets/adjust', input),
  withdrawals: (query: { cursor?: string; limit?: number; status?: string; partnerId?: string }) => api.get<Page<WithdrawalDto>>('/admin/withdrawals', query),
  decideWithdrawal: (id: string, input: WithdrawalDecisionInput) => api.post<WithdrawalDto>(`/admin/withdrawals/${id}/decision`, input),
};
