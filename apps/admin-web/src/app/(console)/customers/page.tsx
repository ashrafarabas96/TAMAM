'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AccountStatus, Permission, type UserDto } from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Avatar, FilterBar, SearchInput } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { customersApi } from '@/lib/api/endpoints/customers';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function CustomersPage() {
  return (
    <RequirePermission anyOf={[Permission.CUSTOMERS_READ]}>
      <CustomersList />
    </RequirePermission>
  );
}

function CustomersList() {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const statuses = useEnumOptions('accountStatus', AccountStatus, t('common.all'));
  const filters = useMemo(() => ({ q: q || undefined, status: (status || undefined) as UserDto['accountStatus'] | undefined }), [q, status]);
  const list = useCursorList<UserDto>({ queryKey: queryKeys.customers.list(filters), fetchPage: (cursor) => customersApi.list({ ...filters, cursor, limit: 30 }) });
  const columns: Column<UserDto>[] = [
    { key: 'name', header: t('common.name'), cell: (u) => <span className="flex items-center gap-2"><Avatar name={u.fullName} src={u.profileImageUrl} size="sm" /><span className="font-medium">{u.fullName ?? '—'}</span></span> },
    { key: 'phone', header: t('common.phone'), cell: (u) => <span dir="ltr">{u.phone}</span> },
    { key: 'email', header: t('common.email'), cell: (u) => <span dir="ltr">{u.email ?? '—'}</span> },
    { key: 'status', header: t('common.status'), cell: (u) => <StatusPill group="accountStatus" value={u.accountStatus} /> },
    { key: 'jobs', header: t('customers.completedJobs'), align: 'end', cell: (u) => <span className="tabular">{u.customer?.completedJobs ?? 0} / <span className="text-danger">{u.customer?.cancelledJobs ?? 0}</span></span> },
    { key: 'rating', header: t('customers.rating'), align: 'end', cell: (u) => <span className="tabular">{u.customer ? `★ ${u.customer.rating.toFixed(1)} (${u.customer.ratingCount})` : '—'}</span> },
    { key: 'lang', header: t('common.language'), cell: (u) => u.language.toUpperCase() },
    { key: 'created', header: t('common.createdAt'), cell: (u) => <DateTime value={u.createdAt} mode="date" /> },
  ];
  return (
    <div>
      <PageHeader title={t('customers.title')} description={t('customers.subtitle')} />
      <FilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('customers.searchPlaceholder')} className="min-w-[260px]" />
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(u) => u.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} onRowClick={(u) => router.push(`/customers/${u.id}`)} emptyTitle={t('customers.empty')} />
    </div>
  );
}
