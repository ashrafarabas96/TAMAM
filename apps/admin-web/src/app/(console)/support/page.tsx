'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  Permission,
  type SupportTicketDto,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { FilterBar, Identifier, SearchInput } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { supportApi } from '@/lib/api/endpoints/support';
import type { UserReportDto } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function SupportPage() {
  return (
    <RequirePermission anyOf={[Permission.SUPPORT_READ]}>
      <SupportScreen />
    </RequirePermission>
  );
}

function SupportScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('support.title')} description={t('support.subtitle')} />
      <Tabs
        items={[
          { value: 'tickets', label: t('support.tickets'), content: <TicketsTab /> },
          { value: 'reports', label: t('support.reports'), content: <ReportsTab /> },
        ]}
      />
    </div>
  );
}

function TicketsTab() {
  const { t, enumLabel } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const statuses = useEnumOptions('ticketStatus', TicketStatus, t('common.all'));
  const priorities = useEnumOptions('ticketPriority', TicketPriority, t('common.all'));
  const categories = useEnumOptions('ticketCategory', TicketCategory, t('common.all'));
  const filters = useMemo(
    () => ({
      q: q || undefined,
      status: status || undefined,
      priority: priority || undefined,
      category: category || undefined,
    }),
    [q, status, priority, category],
  );
  const list = useCursorList<SupportTicketDto>({
    queryKey: queryKeys.support.tickets(filters),
    fetchPage: (cursor) => supportApi.list({ ...filters, cursor, limit: 30 }),
  });
  const columns: Column<SupportTicketDto>[] = [
    {
      key: 'number',
      header: t('support.ticketNumber'),
      cell: (ticket) => <span className="font-semibold text-primary">{ticket.number}</span>,
    },
    {
      key: 'subject',
      header: t('support.subject'),
      cell: (ticket) => <span className="line-clamp-1 max-w-[280px]">{ticket.subject}</span>,
    },
    {
      key: 'category',
      header: t('support.category'),
      cell: (ticket) => enumLabel('ticketCategory', ticket.category),
    },
    {
      key: 'priority',
      header: t('support.priority'),
      cell: (ticket) => <StatusPill group="ticketPriority" value={ticket.priority} />,
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (ticket) => <StatusPill group="ticketStatus" value={ticket.status} />,
    },
    {
      key: 'assignee',
      header: t('support.assignee'),
      cell: (ticket) =>
        ticket.assignedAgentId ? (
          <Identifier value={ticket.assignedAgentId} />
        ) : (
          <span className="text-text-tertiary">{t('support.unassigned')}</span>
        ),
    },
    {
      key: 'job',
      header: t('jobs.job'),
      cell: (ticket) => (ticket.jobId ? <Identifier value={ticket.jobId} /> : '—'),
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (ticket) => <DateTime value={ticket.createdAt} mode="relative" />,
    },
  ];
  return (
    <div>
      <FilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('support.searchPlaceholder')}
          className="min-w-[240px]"
        />
        <Select
          value={status}
          onValueChange={setStatus}
          options={statuses}
          placeholder={t('common.status')}
          aria-label={t('common.status')}
        />
        <Select
          value={priority}
          onValueChange={setPriority}
          options={priorities}
          placeholder={t('support.priority')}
          aria-label={t('support.priority')}
        />
        <Select
          value={category}
          onValueChange={setCategory}
          options={categories}
          placeholder={t('support.category')}
          aria-label={t('support.category')}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(ticket) => ticket.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        onRowClick={(ticket) => router.push(`/support/${ticket.id}`)}
        emptyTitle={t('support.noTickets')}
      />
    </div>
  );
}

function ReportsTab() {
  const { t } = useI18n();
  const list = useCursorList<UserReportDto>({
    queryKey: queryKeys.support.reports({}),
    fetchPage: (cursor) => supportApi.reports({ cursor, limit: 30 }),
  });
  const columns: Column<UserReportDto>[] = [
    {
      key: 'reason',
      header: t('support.reason'),
      cell: (r) => <span className="font-medium">{r.reason}</span>,
    },
    { key: 'status', header: t('common.status'), cell: (r) => r.status },
    { key: 'job', header: t('jobs.job'), cell: (r) => <Identifier value={r.jobId} /> },
    {
      key: 'reporter',
      header: t('support.reporter'),
      cell: (r) => <Identifier value={r.reporterId} />,
    },
    {
      key: 'reported',
      header: t('support.reported'),
      cell: (r) => <Identifier value={r.reportedId} />,
    },
    {
      key: 'ticket',
      header: t('support.ticket'),
      cell: (r) => (r.ticketId ? <Identifier value={r.ticketId} /> : '—'),
    },
    {
      key: 'description',
      header: t('common.description'),
      cell: (r) => (
        <span className="line-clamp-2 max-w-[260px] text-xs">{r.description ?? '—'}</span>
      ),
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (r) => <DateTime value={r.createdAt} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={list.items}
      rowKey={(r) => r.id}
      isLoading={list.isLoading}
      error={list.error}
      onRetry={() => void list.refetch()}
      hasMore={list.hasMore}
      onLoadMore={list.loadMore}
      isLoadingMore={list.isLoadingMore}
      emptyTitle={t('support.noReports')}
    />
  );
}
