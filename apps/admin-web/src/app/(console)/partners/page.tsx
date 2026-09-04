'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import {
  AvailabilityStatus,
  PartnerRoleType,
  type PartnerDto,
  Permission,
  VerificationStatus,
} from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Avatar, FilterBar, SearchInput } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { partnersApi } from '@/lib/api/endpoints/partners';
import { queryKeys } from '@/lib/query-keys';
import { useCategoryOptions, useZoneOptions } from '@/lib/query/reference-data';
import { useCursorList } from '@/lib/query/use-cursor-list';
import { useEnumOptions } from '@/lib/query/use-enum-options';

export default function PartnersPage() {
  return (
    <RequirePermission anyOf={[Permission.PARTNERS_READ]}>
      <Suspense fallback={null}>
        <PartnersList />
      </Suspense>
    </RequirePermission>
  );
}

function PartnersList() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(
    params.get('verificationStatus') ?? '',
  );
  const [availability, setAvailability] = useState('');
  const [role, setRole] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const zones = useZoneOptions(true, t('common.allZones'));
  const categories = useCategoryOptions();
  const verificationOptions = useEnumOptions(
    'verificationStatus',
    VerificationStatus,
    t('common.all'),
  );
  const availabilityOptions = useEnumOptions('availability', AvailabilityStatus, t('common.all'));
  const roleOptions = useEnumOptions('partnerRole', PartnerRoleType, t('common.all'));

  const filters = useMemo(
    () => ({
      q: q || undefined,
      verificationStatus: verificationStatus || undefined,
      availability: (availability || undefined) as PartnerDto['availability'] | undefined,
      role: (role || undefined) as PartnerDto['roles'][number] | undefined,
      zoneId: zoneId || undefined,
      categoryId: categoryId || undefined,
    }),
    [q, verificationStatus, availability, role, zoneId, categoryId],
  );
  const list = useCursorList<PartnerDto>({
    queryKey: queryKeys.partners.list(filters),
    fetchPage: (cursor) => partnersApi.list({ ...filters, cursor, limit: 30 }),
  });

  const columns: Column<PartnerDto>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Avatar name={p.fullName} src={p.profileImageUrl} size="sm" />
          <span>
            <span className="block font-medium">{p.fullName ?? '—'}</span>
            <span className="block text-xs text-text-secondary" dir="ltr">
              {p.phone}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'verification',
      header: t('partners.verification'),
      cell: (p) => <StatusPill group="verificationStatus" value={p.verificationStatus} />,
    },
    {
      key: 'availability',
      header: t('partners.availability'),
      cell: (p) => <StatusPill group="availability" value={p.availability} />,
    },
    {
      key: 'roles',
      header: t('partners.roles'),
      cell: (p) => (
        <span className="flex flex-wrap gap-1">
          {p.roles.map((r) => (
            <StatusPill key={r} group="partnerRole" value={r} />
          ))}
        </span>
      ),
    },
    {
      key: 'zones',
      header: t('common.zones'),
      cell: (p) => (
        <span className="text-xs">{p.zoneIds.map((z) => zones.nameOf(z)).join('، ') || '—'}</span>
      ),
    },
    {
      key: 'rating',
      header: t('customers.rating'),
      align: 'end',
      cell: (p) => (
        <span className="tabular">
          ★ {p.rating.toFixed(1)} ({p.ratingCount})
        </span>
      ),
    },
    {
      key: 'jobs',
      header: t('partners.completedJobs'),
      align: 'end',
      cell: (p) => <span className="tabular">{p.completedJobs}</span>,
    },
    {
      key: 'acceptance',
      header: t('partners.acceptance'),
      align: 'end',
      cell: (p) => (
        <span className="tabular">
          {Math.round(p.acceptanceRate * 100)}% /{' '}
          <span className="text-danger">{Math.round(p.cancellationRate * 100)}%</span>
        </span>
      ),
    },
    {
      key: 'wallet',
      header: t('partners.wallet'),
      align: 'end',
      cell: (p) => <Money value={p.walletBalance} />,
    },
    {
      key: 'heartbeat',
      header: t('partners.lastHeartbeat'),
      cell: (p) => <DateTime value={p.lastHeartbeatAt} mode="relative" />,
    },
  ];

  return (
    <div>
      <PageHeader title={t('partners.title')} description={t('partners.subtitle')} />
      <FilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('partners.searchPlaceholder')}
          className="min-w-[240px]"
        />
        <Select
          value={verificationStatus}
          onValueChange={setVerificationStatus}
          options={verificationOptions}
          placeholder={t('partners.verification')}
          aria-label={t('partners.verification')}
        />
        <Select
          value={availability}
          onValueChange={setAvailability}
          options={availabilityOptions}
          placeholder={t('partners.availability')}
          aria-label={t('partners.availability')}
        />
        <Select
          value={role}
          onValueChange={setRole}
          options={roleOptions}
          placeholder={t('partners.role')}
          aria-label={t('partners.role')}
        />
        <Select
          value={zoneId}
          onValueChange={setZoneId}
          options={zones.options}
          placeholder={t('common.allZones')}
          aria-label={t('common.zone')}
        />
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          options={[{ value: '', label: t('common.all') }, ...categories.options]}
          placeholder={t('services.category')}
          aria-label={t('services.category')}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(p) => p.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        isLoadingMore={list.isLoadingMore}
        onRowClick={(p) => router.push(`/partners/${p.id}`)}
        emptyTitle={t('partners.empty')}
      />
    </div>
  );
}
