'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Permission } from '@tamam/shared-types';

import { JobsList } from '@/components/domain/jobs/jobs-list';
import { AccountStatusDialog } from '@/components/domain/users/account-status-dialog';
import { RestrictionsTable, RiskSignalsTable } from '@/components/domain/users/risk-panels';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Avatar, Identifier } from '@/components/ui/misc';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { customersApi, type ReceivedReviewDto } from '@/lib/api/endpoints/customers';
import { useSession } from '@/lib/auth/session-context';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';

export default function CustomerDetailPage() {
  return (
    <RequirePermission anyOf={[Permission.CUSTOMERS_READ]}>
      <CustomerDetail />
    </RequirePermission>
  );
}

function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { permissions } = useSession();
  const [statusOpen, setStatusOpen] = useState(false);
  const user = useQuery({ queryKey: queryKeys.customers.detail(id), queryFn: () => customersApi.get(id) });

  if (user.isPending) return <SkeletonCard />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  const u = user.data;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.customers'), href: '/customers' }, { label: u.fullName ?? u.phone }]}
        title={<span className="flex items-center gap-3"><Avatar name={u.fullName} src={u.profileImageUrl} /> {u.fullName ?? u.phone}</span>}
        badge={<><StatusPill group="accountStatus" value={u.accountStatus} />{u.roles.map((r) => <StatusPill key={r} group="userRole" value={r} />)}</>}
        actions={<Can anyOf={[Permission.CUSTOMERS_SUSPEND]}><Button variant="danger-soft" size="sm" onClick={() => setStatusOpen(true)}>{t('users.changeStatus')}</Button></Can>}
      />
      <Card title={t('customers.profile')}>
        <KeyValue columns={3} items={[
          { label: t('common.phone'), value: <span dir="ltr">{u.phone}</span> },
          { label: t('common.email'), value: <span dir="ltr">{u.email ?? '—'}</span> },
          { label: t('common.language'), value: u.language.toUpperCase() },
          { label: t('common.currency'), value: u.currency },
          { label: t('customers.rating'), value: u.customer ? `★ ${u.customer.rating.toFixed(2)} (${u.customer.ratingCount})` : '—' },
          { label: t('customers.completedJobs'), value: u.customer ? `${u.customer.completedJobs} / ${u.customer.cancelledJobs} ${t('customers.cancelledShort')}` : '—' },
          { label: t('customers.referralCode'), value: u.customer?.referralCode ? <Badge tone="accent">{u.customer.referralCode}</Badge> : '—' },
          { label: t('common.createdAt'), value: <DateTime value={u.createdAt} /> },
          { label: t('common.id'), value: <Identifier value={u.id} short={false} /> },
        ]} />
      </Card>
      <Tabs
        items={[
          { value: 'jobs', label: t('nav.jobs'), content: permissions.can(Permission.JOBS_READ_ALL) ? <JobsList fixed={{ customerId: u.id }} /> : <p className="text-xs text-text-secondary">{t('errors.forbiddenDescription')}</p> },
          { value: 'reviews', label: t('customers.reviews'), content: <ReviewsTab userId={u.id} /> },
          { value: 'risk', label: t('nav.risk'), content: permissions.can(Permission.RISK_READ) ? <div className="space-y-6"><RiskSignalsTable filters={{ userId: u.id }} showUser={false} /><RestrictionsTable filters={{ targetType: 'USER', targetId: u.id }} /></div> : <p className="text-xs text-text-secondary">{t('errors.forbiddenDescription')}</p> },
        ]}
      />
      <AccountStatusDialog open={statusOpen} onOpenChange={setStatusOpen} subject={u.fullName ?? u.phone} submit={(input) => customersApi.changeStatus(u.id, input)} onDone={() => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })} />
    </div>
  );
}

function ReviewsTab({ userId }: { userId: string }) {
  const { t } = useI18n();
  const list = useCursorList<ReceivedReviewDto>({ queryKey: queryKeys.customers.reviews(userId), fetchPage: (cursor) => customersApi.reviews(userId, { cursor, limit: 30 }) });
  const columns: Column<ReceivedReviewDto>[] = [
    { key: 'rating', header: t('customers.rating'), cell: (r) => <span className="font-semibold text-warning-strong">{'★'.repeat(r.rating)}<span className="text-text-tertiary">{'★'.repeat(5 - r.rating)}</span></span> },
    { key: 'direction', header: t('common.type'), cell: (r) => <Badge tone="neutral">{r.direction}</Badge> },
    { key: 'rater', header: t('customers.raterName'), cell: (r) => r.raterName ?? '—' },
    { key: 'tags', header: t('customers.tags'), cell: (r) => <span className="flex flex-wrap gap-1">{r.tags.map((tag) => <Badge key={tag} tone="brand">{tag}</Badge>)}</span> },
    { key: 'comment', header: t('customers.comment'), cell: (r) => <span className="line-clamp-2 max-w-[300px] text-xs">{r.comment ?? '—'}</span> },
    { key: 'job', header: t('jobs.job'), cell: (r) => <Identifier value={r.jobId} /> },
    { key: 'created', header: t('common.createdAt'), cell: (r) => <DateTime value={r.createdAt} /> },
  ];
  return <DataTable columns={columns} rows={list.items} rowKey={(r) => r.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('customers.noReviews')} dense />;
}
