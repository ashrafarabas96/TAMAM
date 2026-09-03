'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CommissionScope, JobType, LedgerAccountType, LedgerTransactionType, type PaymentDto, PaymentMethod, PaymentStatus, Permission, RefundStatus, SUPPORTED_CURRENCIES, WithdrawalStatus } from '@tamam/shared-types';
import { type IssueRefundInput, issueRefundSchema, type UpsertCommissionPolicyInput, upsertCommissionPolicySchema, type WalletAdjustmentInput, walletAdjustmentSchema, type WithdrawalDecisionInput, withdrawalDecisionSchema } from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, FormGrid, MinorAmountField, NativeSelectField, NumberField, SwitchField, TextareaField, TextField } from '@/components/ui/form';
import { FilterBar, Identifier, SearchInput } from '@/components/ui/misc';
import { MinorMoney, Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { ledgerApi } from '@/lib/api/endpoints/ledger';
import { paymentsApi } from '@/lib/api/endpoints/payments';
import type { CommissionPolicyDto, LedgerAccountDto, LedgerTransactionDto, RefundDto, WithdrawalDto } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session-context';
import { createIdempotencyKey } from '@/lib/idempotency';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function FinancePage() {
  return (
    <RequirePermission anyOf={[Permission.PAYMENTS_READ, Permission.LEDGER_READ, Permission.WITHDRAWALS_MANAGE, Permission.COMMISSION_MANAGE]}>
      <Suspense fallback={null}>
        <FinanceScreen />
      </Suspense>
    </RequirePermission>
  );
}

function FinanceScreen() {
  const { t } = useI18n();
  const { permissions } = useSession();
  const params = useSearchParams();
  const tabs = [
    ...(permissions.can(Permission.PAYMENTS_READ) ? [{ value: 'payments', label: t('finance.payments'), content: <PaymentsTab /> }] : []),
    ...(permissions.can(Permission.PAYMENTS_READ) ? [{ value: 'refunds', label: t('finance.refunds'), content: <RefundsTab /> }] : []),
    ...(permissions.can(Permission.WITHDRAWALS_MANAGE) ? [{ value: 'withdrawals', label: t('finance.withdrawals'), content: <WithdrawalsTab /> }] : []),
    ...(permissions.can(Permission.LEDGER_READ) ? [{ value: 'accounts', label: t('finance.accounts'), content: <AccountsTab /> }] : []),
    ...(permissions.can(Permission.LEDGER_READ) ? [{ value: 'transactions', label: t('finance.transactions'), content: <TransactionsTab /> }] : []),
    ...(permissions.can(Permission.COMMISSION_MANAGE) ? [{ value: 'commission', label: t('finance.commission'), content: <CommissionTab /> }] : []),
  ];
  const requested = params.get('tab');
  const initial = tabs.find((tab) => tab.value === requested)?.value ?? tabs[0]?.value;
  return (
    <div>
      <PageHeader title={t('finance.title')} description={t('finance.subtitle')} />
      {tabs.length > 0 ? <Tabs items={tabs} defaultValue={initial} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ payments */
function PaymentsTab() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [jobId, setJobId] = useState(params.get('jobId') ?? '');
  const [refundFor, setRefundFor] = useState<PaymentDto | null>(null);
  const statuses = useEnumOptions('paymentStatus', PaymentStatus, t('common.all'));
  const methods = useEnumOptions('paymentMethod', PaymentMethod, t('common.all'));
  const filters = useMemo(() => ({ status: status || undefined, method: method || undefined, jobId: jobId || undefined }), [status, method, jobId]);
  const list = useCursorList<PaymentDto>({ queryKey: queryKeys.finance.payments(filters), fetchPage: (cursor) => paymentsApi.list({ ...filters, cursor, limit: 30 }) });

  const columns: Column<PaymentDto>[] = [
    { key: 'id', header: t('common.id'), cell: (p) => <Identifier value={p.id} /> },
    { key: 'job', header: t('jobs.job'), cell: (p) => <Link className="text-primary hover:underline" href={`/jobs/${p.jobId}`}><Identifier value={p.jobId} /></Link> },
    { key: 'method', header: t('jobs.paymentMethod'), cell: (p) => <StatusPill group="paymentMethod" value={p.method} /> },
    { key: 'status', header: t('common.status'), cell: (p) => <StatusPill group="paymentStatus" value={p.status} /> },
    { key: 'amount', header: t('common.amount'), align: 'end', cell: (p) => <Money value={p.amount} /> },
    { key: 'captured', header: t('finance.captured'), align: 'end', cell: (p) => <Money value={p.capturedAmount} /> },
    { key: 'refunded', header: t('finance.refunded'), align: 'end', cell: (p) => <Money value={p.refundedAmount} /> },
    { key: 'provider', header: t('finance.providerRef'), cell: (p) => <span className="font-mono text-xs" dir="ltr">{p.providerRef ?? '—'}</span> },
    { key: 'created', header: t('common.createdAt'), cell: (p) => <DateTime value={p.createdAt} /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (p) => <Can anyOf={[Permission.REFUNDS_ISSUE]}><Button size="sm" variant="outline" onClick={() => setRefundFor(p)} disabled={p.status !== 'CAPTURED' && p.status !== 'PARTIALLY_REFUNDED'}>{t('finance.refund')}</Button></Can> },
  ];
  return (
    <div>
      <FilterBar>
        <SearchInput value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder={t('finance.jobIdPlaceholder')} className="min-w-[240px]" />
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
        <Select value={method} onValueChange={setMethod} options={methods} placeholder={t('jobs.paymentMethod')} aria-label={t('jobs.paymentMethod')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(p) => p.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('finance.noPayments')} />
      <RefundDialog payment={refundFor} onClose={() => setRefundFor(null)} />
    </div>
  );
}

function RefundDialog({ payment, onClose }: { payment: PaymentDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey('refund'));
  const form = useForm<IssueRefundInput>({ resolver: zodResolver(issueRefundSchema), defaultValues: { paymentId: '', amountMinor: 0, reason: '' } });
  useEffect(() => {
    if (!payment) return;
    setIdempotencyKey(createIdempotencyKey('refund'));
    form.reset({ paymentId: payment.id, amountMinor: payment.capturedAmount.amount - payment.refundedAmount.amount, reason: '' });
  }, [payment, form]);
  const mutation = useMutation({
    mutationFn: (input: IssueRefundInput) => paymentsApi.issueRefund(input, idempotencyKey),
    onSuccess: async () => {
      toast.success(t('finance.refundIssued'));
      onClose();
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()} title={t('finance.issueRefund')} description={payment ? `${payment.id}` : undefined} size="sm" locked={mutation.isPending} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" loading={mutation.isPending} onClick={submit}>{t('finance.refund')}</Button></>}>
      <form onSubmit={submit} className="space-y-3">
        <MinorAmountField control={form.control} name="amountMinor" label={t('common.amount')} currency={payment?.amount.currency ?? 'ILS'} required hint={t('finance.refundMaxHint')} />
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
        <p className="text-[11px] text-text-tertiary" dir="ltr">Idempotency-Key: {idempotencyKey}</p>
      </form>
    </Dialog>
  );
}

function RefundsTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const statuses = useEnumOptions('refundStatus', RefundStatus, t('common.all'));
  const filters = useMemo(() => ({ status: status || undefined }), [status]);
  const list = useCursorList<RefundDto>({ queryKey: queryKeys.finance.refunds(filters), fetchPage: (cursor) => paymentsApi.refunds({ ...filters, cursor, limit: 30 }) });
  const columns: Column<RefundDto>[] = [
    { key: 'id', header: t('common.id'), cell: (r) => <Identifier value={r.id} /> },
    { key: 'payment', header: t('finance.payment'), cell: (r) => <Identifier value={r.paymentId} /> },
    { key: 'job', header: t('jobs.job'), cell: (r) => <Link className="text-primary hover:underline" href={`/jobs/${r.jobId}`}><Identifier value={r.jobId} /></Link> },
    { key: 'status', header: t('common.status'), cell: (r) => <StatusPill group="refundStatus" value={r.status} /> },
    { key: 'amount', header: t('common.amount'), align: 'end', cell: (r) => <Money value={r.amount} /> },
    { key: 'reason', header: t('common.reason'), cell: (r) => <span className="line-clamp-2 max-w-[240px] text-xs">{r.reason}</span> },
    { key: 'dispute', header: t('nav.disputes'), cell: (r) => (r.disputeId ? <Link className="text-primary hover:underline" href={`/disputes/${r.disputeId}`}><Identifier value={r.disputeId} /></Link> : '—') },
    { key: 'processed', header: t('finance.processedAt'), cell: (r) => <DateTime value={r.processedAt} /> },
    { key: 'created', header: t('common.createdAt'), cell: (r) => <DateTime value={r.createdAt} /> },
  ];
  return (
    <div>
      <FilterBar>
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(r) => r.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('finance.noRefunds')} />
    </div>
  );
}

/* --------------------------------------------------------------- withdrawals */
function WithdrawalsTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [deciding, setDeciding] = useState<WithdrawalDto | null>(null);
  const statuses = useEnumOptions('withdrawalStatus', WithdrawalStatus, t('common.all'));
  const filters = useMemo(() => ({ status: status || undefined }), [status]);
  const list = useCursorList<WithdrawalDto>({ queryKey: queryKeys.finance.withdrawals(filters), fetchPage: (cursor) => paymentsApi.withdrawals({ ...filters, cursor, limit: 30 }) });
  const form = useForm<WithdrawalDecisionInput>({ resolver: zodResolver(withdrawalDecisionSchema), defaultValues: { decision: 'APPROVE', reason: '' } });
  useEffect(() => {
    if (deciding) form.reset({ decision: 'APPROVE', reason: '' });
  }, [deciding, form]);
  const mutation = useMutation({
    mutationFn: (input: WithdrawalDecisionInput) => paymentsApi.decideWithdrawal(deciding?.id ?? '', input),
    onSuccess: async () => {
      toast.success(t('finance.withdrawalDecided'));
      setDeciding(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const columns: Column<WithdrawalDto>[] = [
    { key: 'partner', header: t('jobs.partner'), cell: (w) => <Link className="text-primary hover:underline" href={`/partners/${w.partnerId}`}><Identifier value={w.partnerId} /></Link> },
    { key: 'bank', header: t('finance.bank'), cell: (w) => <span className="text-xs" dir="ltr">{w.bankName} ····{w.ibanLast4}</span> },
    { key: 'amount', header: t('common.amount'), align: 'end', cell: (w) => <Money value={w.amount} /> },
    { key: 'fee', header: t('finance.fee'), align: 'end', cell: (w) => <Money value={w.fee} /> },
    { key: 'status', header: t('common.status'), cell: (w) => <StatusPill group="withdrawalStatus" value={w.status} /> },
    { key: 'reference', header: t('finance.providerRef'), cell: (w) => <span className="font-mono text-xs" dir="ltr">{w.providerReference ?? '—'}</span> },
    { key: 'decided', header: t('finance.decidedAt'), cell: (w) => <DateTime value={w.decidedAt} /> },
    { key: 'created', header: t('common.createdAt'), cell: (w) => <DateTime value={w.createdAt} /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (w) => (w.status === 'REQUESTED' || w.status === 'APPROVED' ? <Button size="sm" variant="outline" onClick={() => setDeciding(w)}>{t('finance.decide')}</Button> : null) },
  ];
  return (
    <div>
      <FilterBar>
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(w) => w.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('finance.noWithdrawals')} />
      <Dialog open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)} title={t('finance.decide')} description={deciding ? `${deciding.bankName} ····${deciding.ibanLast4}` : undefined} size="sm" locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => setDeciding(null)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.apply')}</Button></>}>
        <form onSubmit={submit} className="space-y-3">
          <NativeSelectField control={form.control} name="decision" label={t('finance.decision')} options={(['APPROVE', 'REJECT', 'MARK_PAID'] as const).map((d) => ({ value: d, label: enumLabel('withdrawalDecision', d) }))} required />
          <TextField control={form.control} name="providerReference" label={t('finance.providerRef')} dir="ltr" />
          <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
        </form>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------- ledger */
function AccountsTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState('');
  const [type, setType] = useState('');
  const [statementFor, setStatementFor] = useState<LedgerAccountDto | null>(null);
  const [adjusting, setAdjusting] = useState<LedgerAccountDto | null>(null);
  const filters = useMemo(() => ({ currency: currency || undefined, type: type || undefined }), [currency, type]);
  const query = useQuery({ queryKey: queryKeys.finance.accounts(filters), queryFn: () => ledgerApi.accounts(filters) });
  const verify = useMutation({
    mutationFn: (walletId: string) => ledgerApi.verifyWallet(walletId),
    onSuccess: (result) => {
      if (result.matches) toast.success(t('finance.walletMatches'));
      else toast.error(t('finance.walletMismatch'), `${result.cachedBalance.amount} ≠ ${result.recomputedBalance.amount}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (e) => toast.fromError(e),
  });
  const types = useEnumOptions('ledgerAccountType', LedgerAccountType, t('common.all'));
  const columns: Column<LedgerAccountDto>[] = [
    { key: 'code', header: t('finance.accountCode'), cell: (a) => <span className="font-mono text-xs" dir="ltr">{a.code}</span> },
    { key: 'type', header: t('common.type'), cell: (a) => <Badge tone="brand">{enumLabel('ledgerAccountType', a.type)}</Badge> },
    { key: 'currency', header: t('common.currency'), cell: (a) => a.currency },
    { key: 'balance', header: t('finance.balance'), align: 'end', cell: (a) => <Money value={a.balance} /> },
    { key: 'wallet', header: t('finance.wallet'), cell: (a) => (a.walletId ? <Identifier value={a.walletId} /> : '—') },
    { key: 'created', header: t('common.createdAt'), cell: (a) => <DateTime value={a.createdAt} mode="date" /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (a) => (a.walletId ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setStatementFor(a)}>{t('finance.statement')}</Button>
        <Button size="sm" variant="outline" loading={verify.isPending && verify.variables === a.walletId} onClick={() => verify.mutate(a.walletId as string)}>{t('finance.verify')}</Button>
        <Can anyOf={[Permission.WALLET_ADJUST]}><Button size="sm" variant="danger-soft" onClick={() => setAdjusting(a)}>{t('finance.adjust')}</Button></Can>
      </div>
    ) : null) },
  ];
  return (
    <div>
      <FilterBar>
        <Select value={currency} onValueChange={setCurrency} options={[{ value: '', label: t('common.all') }, ...SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))]} placeholder={t('common.currency')} aria-label={t('common.currency')} />
        <Select value={type} onValueChange={setType} options={types} placeholder={t('common.type')} aria-label={t('common.type')} />
      </FilterBar>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(a) => a.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('finance.noAccounts')} />
      <StatementDialog account={statementFor} onClose={() => setStatementFor(null)} />
      <AdjustDialog account={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function StatementDialog({ account, onClose }: { account: LedgerAccountDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const walletId = account?.walletId ?? '';
  const list = useCursorList({ queryKey: queryKeys.finance.statement(walletId), fetchPage: (cursor) => ledgerApi.statement(walletId, { cursor, limit: 30 }), enabled: !!walletId });
  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()} size="lg" title={t('finance.statement')} description={account?.code} footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>
      <DataTable
        columns={[
          { key: 'created', header: t('common.createdAt'), cell: (e) => <DateTime value={e.createdAt} /> },
          { key: 'type', header: t('common.type'), cell: (e) => <Badge tone="neutral">{e.transactionType}</Badge> },
          { key: 'direction', header: t('finance.direction'), cell: (e) => <StatusPill group="ledgerDirection" value={e.direction} /> },
          { key: 'amount', header: t('common.amount'), align: 'end', cell: (e) => <Money value={e.amount} /> },
          { key: 'balance', header: t('finance.balanceAfter'), align: 'end', cell: (e) => <Money value={e.balanceAfter} /> },
          { key: 'description', header: t('common.description'), cell: (e) => <span className="line-clamp-2 max-w-[240px] text-xs">{e.description}</span> },
        ]}
        rows={list.items}
        rowKey={(e) => e.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        emptyTitle={t('finance.noEntries')}
        dense
      />
    </Dialog>
  );
}

function AdjustDialog({ account, onClose }: { account: LedgerAccountDto | null; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<WalletAdjustmentInput>({ resolver: zodResolver(walletAdjustmentSchema), defaultValues: { walletId: '', amountMinor: 0, reason: '', reference: '' } });
  useEffect(() => {
    if (account?.walletId) form.reset({ walletId: account.walletId, amountMinor: 0, reason: '', reference: '' });
  }, [account, form]);
  const mutation = useMutation({
    mutationFn: (input: WalletAdjustmentInput) => paymentsApi.adjustWallet(input),
    onSuccess: async () => {
      toast.success(t('finance.adjusted'));
      onClose();
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()} size="sm" title={t('finance.adjust')} description={account?.code} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" loading={mutation.isPending} onClick={submit}>{t('common.apply')}</Button></>}>
      <form onSubmit={submit} className="space-y-3">
        <NumberField control={form.control} name="amountMinor" label={t('finance.amountMinor')} hint={t('finance.amountMinorHint')} required />
        <TextField control={form.control} name="reference" label={t('finance.reference')} required />
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}

function TransactionsTab() {
  const { t, enumLabel } = useI18n();
  const [type, setType] = useState('');
  const [jobId, setJobId] = useState('');
  const types = useEnumOptions('ledgerTransactionType', LedgerTransactionType, t('common.all'));
  const filters = useMemo(() => ({ type: type || undefined, jobId: jobId || undefined }), [type, jobId]);
  const list = useCursorList<LedgerTransactionDto>({ queryKey: queryKeys.finance.transactions(filters), fetchPage: (cursor) => ledgerApi.transactions({ ...filters, cursor, limit: 30 }) });
  const columns: Column<LedgerTransactionDto>[] = [
    { key: 'created', header: t('common.createdAt'), cell: (tx) => <DateTime value={tx.createdAt} /> },
    { key: 'type', header: t('common.type'), cell: (tx) => <Badge tone="brand">{enumLabel('ledgerTransactionType', tx.type)}</Badge> },
    { key: 'description', header: t('common.description'), cell: (tx) => <span className="line-clamp-2 max-w-[220px] text-xs">{tx.description}</span> },
    { key: 'job', header: t('jobs.job'), cell: (tx) => (tx.jobId ? <Link className="text-primary hover:underline" href={`/jobs/${tx.jobId}`}><Identifier value={tx.jobId} /></Link> : '—') },
    { key: 'entries', header: t('finance.entries'), cell: (tx) => (
      <ul className="space-y-0.5 text-xs">
        {tx.entries.map((e) => (
          <li key={e.id} className="flex items-center gap-2">
            <StatusPill group="ledgerDirection" value={e.direction} />
            <span className="font-mono" dir="ltr">{e.accountCode}</span>
            <Money value={e.amount} />
          </li>
        ))}
      </ul>
    ) },
    { key: 'reference', header: t('finance.reference'), cell: (tx) => <span className="font-mono text-xs" dir="ltr">{tx.reference ?? '—'}</span> },
  ];
  return (
    <div>
      <FilterBar>
        <SearchInput value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder={t('finance.jobIdPlaceholder')} className="min-w-[240px]" />
        <Select value={type} onValueChange={setType} options={types} placeholder={t('common.type')} aria-label={t('common.type')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(tx) => tx.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('finance.noTransactions')} />
    </div>
  );
}

/* ---------------------------------------------------------------- commission */
function CommissionTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions();
  const categories = useCategoryOptions();
  const [editing, setEditing] = useState(false);
  const query = useQuery({ queryKey: queryKeys.finance.commission, queryFn: ledgerApi.commissionPolicies });
  const form = useForm<UpsertCommissionPolicyInput>({
    resolver: zodResolver(upsertCommissionPolicySchema),
    defaultValues: { scope: CommissionScope.GLOBAL, percent: 15, fixedMinor: 0, validFrom: '', priority: 0, isActive: true, reason: '' },
  });
  const scope = form.watch('scope');
  const mutation = useMutation({
    mutationFn: (input: UpsertCommissionPolicyInput) => ledgerApi.upsertCommissionPolicy({ ...input, validFrom: fromDateTimeLocalValue(input.validFrom) ?? input.validFrom, validTo: input.validTo ? fromDateTimeLocalValue(input.validTo) : null }),
    onSuccess: async () => {
      toast.success(t('finance.commissionSaved'));
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const columns: Column<CommissionPolicyDto>[] = [
    { key: 'scope', header: t('finance.scope'), cell: (p) => <Badge tone="brand">{enumLabel('commissionScope', p.scope)}</Badge> },
    { key: 'target', header: t('finance.scopeTarget'), cell: (p) => <span className="text-xs">{p.jobType ?? p.campaignCode ?? (p.zoneId ? zones.nameOf(p.zoneId) : p.categoryId ? categories.nameOf(p.categoryId) : p.partnerId ? p.partnerId.slice(0, 8) : '—')}</span> },
    { key: 'percent', header: t('finance.percent'), align: 'end', cell: (p) => <span className="tabular font-semibold">{p.percent}%</span> },
    { key: 'fixed', header: t('finance.fixed'), align: 'end', cell: (p) => <MinorMoney amount={p.fixedMinor} currency="ILS" /> },
    { key: 'priority', header: t('pricing.priority'), align: 'end', cell: (p) => p.priority },
    { key: 'validity', header: t('pricing.validity'), cell: (p) => <span className="text-xs"><DateTime value={p.validFrom} mode="date" />{p.validTo ? <> → <DateTime value={p.validTo} mode="date" /></> : ''}</span> },
    { key: 'active', header: t('common.active'), cell: (p) => <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? t('common.yes') : t('common.no')}</Badge> },
  ];
  return (
    <div>
      <FilterBar>
        <Button size="sm" className="ms-auto" onClick={() => setEditing(true)}>{t('finance.newCommissionPolicy')}</Button>
      </FilterBar>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(p) => p.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('finance.noCommissionPolicies')} />
      <Dialog open={editing} onOpenChange={setEditing} size="lg" title={t('finance.newCommissionPolicy')} description={t('finance.commissionHint')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <FormGrid cols={3}>
            <NativeSelectField control={form.control} name="scope" label={t('finance.scope')} options={Object.values(CommissionScope).map((s) => ({ value: s, label: enumLabel('commissionScope', s) }))} required />
            {scope === 'JOB_TYPE' ? <NativeSelectField control={form.control} name="scopeCode" label={t('common.jobType')} options={[JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE].map((j) => ({ value: j, label: enumLabel('jobType', j) }))} nullable /> : null}
            {scope === 'ZONE' ? <NativeSelectField control={form.control} name="scopeId" label={t('common.zone')} options={zones.options} nullable /> : null}
            {scope === 'CATEGORY' ? <NativeSelectField control={form.control} name="scopeId" label={t('services.category')} options={categories.options} nullable /> : null}
            {scope === 'PARTNER' ? <TextField control={form.control} name="scopeId" label={t('jobs.partner')} dir="ltr" /> : null}
            {scope === 'CAMPAIGN' ? <TextField control={form.control} name="scopeCode" label={t('finance.campaignCode')} dir="ltr" /> : null}
            <NumberField control={form.control} name="percent" label={t('finance.percent')} min={0} max={60} step="0.5" required />
            <MinorAmountField control={form.control} name="fixedMinor" label={t('finance.fixed')} currency="ILS" />
            <NumberField control={form.control} name="priority" label={t('pricing.priority')} min={0} max={1000} />
            <TextField control={form.control} name="validFrom" label={t('pricing.validFrom')} type="datetime-local" dir="ltr" required />
            <TextField control={form.control} name="validTo" label={t('pricing.validTo')} type="datetime-local" dir="ltr" />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </FormGrid>
          <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
        </form>
      </Dialog>
    </div>
  );
}
