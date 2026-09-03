'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CampaignStatus, type CampaignDto, Permission } from '@tamam/shared-types';

import { TargetingTester } from '@/components/domain/campaigns/targeting-tester';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { FilterBar, SearchInput } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { campaignsApi } from '@/lib/api/endpoints/campaigns';
import { formatNumber, formatPercent } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function CampaignsPage() {
  return (
    <RequirePermission anyOf={[Permission.CAMPAIGNS_READ]}>
      <CampaignsScreen />
    </RequirePermission>
  );
}

function CampaignsScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        title={t('campaigns.title')}
        description={t('campaigns.subtitle')}
        actions={<Can anyOf={[Permission.CAMPAIGNS_MANAGE]}><Link href="/campaigns/new" className="inline-flex h-9 items-center gap-2 rounded-button bg-primary px-3 text-xs font-semibold text-text-on-brand hover:bg-primary-hover"><Plus className="h-4 w-4" aria-hidden />{t('campaigns.new')}</Link></Can>}
      />
      <Tabs
        items={[
          { value: 'list', label: t('campaigns.allCampaigns'), content: <CampaignsList /> },
          { value: 'tester', label: t('campaigns.tester'), content: <TargetingTester /> },
        ]}
      />
    </div>
  );
}

function CampaignsList() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const statuses = useEnumOptions('campaignStatus', CampaignStatus, t('common.all'));
  const filters = useMemo(() => ({ q: q || undefined, status: status || undefined }), [q, status]);
  const list = useCursorList<CampaignDto>({ queryKey: queryKeys.campaigns.list(filters), fetchPage: (cursor) => campaignsApi.list({ ...filters, cursor, limit: 30 }) });

  const columns: Column<CampaignDto>[] = [
    { key: 'name', header: t('common.name'), cell: (c) => <span><Link href={`/campaigns/${c.id}`} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link><span className="block text-xs text-text-secondary">{c.description ?? ''}</span></span> },
    { key: 'status', header: t('common.status'), cell: (c) => <StatusPill group="campaignStatus" value={c.status} /> },
    { key: 'placements', header: t('campaigns.placements'), cell: (c) => <span className="flex flex-wrap gap-1">{[...new Set(c.banners.map((b) => b.placement))].map((p) => <Badge key={p} tone="brand">{p}</Badge>)}</span> },
    { key: 'window', header: t('campaigns.schedule'), cell: (c) => <span className="text-xs"><DateTime value={c.startsAt} mode="date" />{c.endsAt ? <> → <DateTime value={c.endsAt} mode="date" /></> : ` → ${t('campaigns.openEnded')}`}</span> },
    { key: 'impressions', header: t('campaigns.impressions'), align: 'end', cell: (c) => <span className="tabular">{formatNumber(c.stats.impressions, locale)}</span> },
    { key: 'clicks', header: t('campaigns.clicks'), align: 'end', cell: (c) => <span className="tabular">{formatNumber(c.stats.clicks, locale)}</span> },
    { key: 'ctr', header: t('campaigns.ctr'), align: 'end', cell: (c) => <span className="tabular font-semibold">{formatPercent(c.stats.ctr, locale, 2)}</span> },
    { key: 'conversions', header: t('campaigns.conversions'), align: 'end', cell: (c) => <span className="tabular">{formatNumber(c.stats.conversions, locale)}</span> },
    { key: 'rollout', header: t('campaigns.rolloutPercent'), align: 'end', cell: (c) => `${c.targeting.rolloutPercent}%` },
    { key: 'updated', header: t('common.updatedAt'), cell: (c) => <DateTime value={c.updatedAt} mode="relative" /> },
  ];

  return (
    <div>
      <FilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('campaigns.searchPlaceholder')} className="min-w-[240px]" />
        <Select value={status} onValueChange={setStatus} options={statuses} placeholder={t('common.status')} aria-label={t('common.status')} />
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(c) => c.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} onRowClick={(c) => router.push(`/campaigns/${c.id}`)} emptyTitle={t('campaigns.empty')} emptyDescription={t('campaigns.emptyDescription')} />
    </div>
  );
}
