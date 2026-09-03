import type { LedgerEntryDto, Page } from '@tamam/shared-types';
import type { UpsertCommissionPolicyInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { CommissionPolicyDto, LedgerAccountDto, LedgerTransactionDto, WalletIntegrityDto } from '@/lib/api/types';

export const ledgerApi = {
  accounts: (query: { currency?: string; type?: string }) => api.get<LedgerAccountDto[]>('/admin/ledger/accounts', query),
  transactions: (query: { cursor?: string; limit?: number; jobId?: string; type?: string; from?: string; to?: string }) => api.get<Page<LedgerTransactionDto>>('/admin/ledger/transactions', query),
  statement: (walletId: string, query: { cursor?: string; limit?: number }) => api.get<Page<LedgerEntryDto>>(`/admin/ledger/wallets/${walletId}/statement`, query),
  verifyWallet: (walletId: string) => api.post<WalletIntegrityDto>(`/admin/ledger/wallets/${walletId}/verify`),
  commissionPolicies: () => api.get<CommissionPolicyDto[]>('/admin/commission-policies'),
  upsertCommissionPolicy: (input: UpsertCommissionPolicyInput) => api.put<CommissionPolicyDto>('/admin/commission-policies', input),
};
