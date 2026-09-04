'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ImageOff, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';

import { ChaletApprovalStatus, Permission } from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { type TranslationKey, useI18n } from '@/i18n';
import { chaletsApi } from '@/lib/api/endpoints/chalets';
import type { AdminChaletRow } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';

import { ChaletReviewDialog } from './review-dialog';

/**
 * The review queue.
 *
 * A chalet is somebody's property advertised on the platform's word, so it
 * goes live because a reviewer said so. The queue's job is to make that
 * decision cheap: the readiness of each submission is on the row, so a chalet
 * with no photos can be sent back without opening it.
 */
export default function ChaletsPage() {
  return (
    <RequirePermission anyOf={[Permission.CHALETS_READ]}>
      <ChaletsScreen />
    </RequirePermission>
  );
}

const TABS: Array<{ key: TranslationKey; status?: ChaletApprovalStatus }> = [
  { key: 'chalets.pending', status: ChaletApprovalStatus.PENDING },
  { key: 'chalets.approved', status: ChaletApprovalStatus.APPROVED },
  { key: 'chalets.rejected', status: ChaletApprovalStatus.REJECTED },
  { key: 'chalets.all' },
];

function ChaletsScreen() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [reviewing, setReviewing] = useState<AdminChaletRow | null>(null);

  const filters = { approvalStatus: TABS[tab]?.status, limit: 50 };
  const chalets = useQuery({
    queryKey: queryKeys.chalets.list(filters),
    queryFn: () => chaletsApi.list(filters),
  });

  const suspend = useMutation({
    mutationFn: ({ id, suspend: on, reason }: { id: string; suspend: boolean; reason: string }) =>
      chaletsApi.setSuspended(id, { suspend: on, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chalets.all }),
  });

  const name = (row: AdminChaletRow) => (locale === 'ar' ? row.nameAr : row.nameEn);

  const columns: Column<AdminChaletRow>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (row) => (
        <span>
          <span className="block font-medium">{name(row)}</span>
          <span className="block text-[11px] text-text-tertiary">{row.city}</span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: t('chalets.owner'),
      cell: (row) => (
        <span>
          <span className="block">{row.ownerName ?? '—'}</span>
          <span className="block font-mono text-[11px] text-text-tertiary" dir="ltr">
            {row.ownerPhone}
          </span>
        </span>
      ),
    },
    {
      key: 'readiness',
      header: t('chalets.readiness'),
      // Whether there is enough here to review at all, without opening it.
      cell: (row) =>
        row.photoCount === 0 ? (
          <Badge tone="warning">
            <ImageOff className="me-1 h-3 w-3" aria-hidden />
            {t('chalets.noPhotos')}
          </Badge>
        ) : (
          <span className="text-text-secondary">
            {row.photoCount} · {row.amenityCount}
          </span>
        ),
    },
    {
      key: 'capacity',
      header: t('chalets.capacity'),
      cell: (row) => row.maximumGuests,
    },
    {
      key: 'rate',
      header: t('chalets.rate'),
      cell: (row) => (
        <span dir="ltr">
          {(row.baseHourlyRate.amount / 100).toFixed(2)} {row.baseHourlyRate.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (row) => <StatusBadge row={row} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          {row.approvalStatus === ChaletApprovalStatus.APPROVED ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                suspend.mutate({
                  id: row.id,
                  suspend: row.status !== 'SUSPENDED',
                  reason:
                    row.status === 'SUSPENDED'
                      ? t('chalets.unsuspend')
                      : t('chalets.suspendReason'),
                })
              }
            >
              {row.status === 'SUSPENDED' ? t('chalets.unsuspend') : t('chalets.suspend')}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setReviewing(row)}>
            {t('chalets.review')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t('chalets.title')} description={t('chalets.subtitle')} />

      <div className="flex gap-2">
        {TABS.map((entry, index) => (
          <Button
            key={entry.key}
            variant={index === tab ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab(index)}
          >
            {t(entry.key)}
          </Button>
        ))}
      </div>

      {chalets.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chalets.isError ? (
        <ErrorState error={chalets.error} onRetry={() => void chalets.refetch()} />
      ) : (chalets.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={
            TABS[tab]?.status === ChaletApprovalStatus.PENDING
              ? t('chalets.emptyPending')
              : t('chalets.empty')
          }
        />
      ) : (
        <DataTable columns={columns} rows={chalets.data?.items ?? []} rowKey={(r) => r.id} />
      )}

      {reviewing ? (
        <ChaletReviewDialog chaletId={reviewing.id} onClose={() => setReviewing(null)} />
      ) : null}
    </div>
  );
}

function StatusBadge({ row }: { row: AdminChaletRow }) {
  const { t } = useI18n();

  if (row.approvalStatus === ChaletApprovalStatus.REJECTED) {
    return (
      <Badge tone="danger">
        <XCircle className="me-1 h-3 w-3" aria-hidden />
        {t('chalets.rejected')}
      </Badge>
    );
  }
  if (row.status === 'SUSPENDED') {
    return (
      <Badge tone="danger">
        <ShieldAlert className="me-1 h-3 w-3" aria-hidden />
        {t('chalets.suspended')}
      </Badge>
    );
  }
  if (row.approvalStatus === ChaletApprovalStatus.APPROVED) {
    return (
      <Badge tone="success">
        <CheckCircle2 className="me-1 h-3 w-3" aria-hidden />
        {t('chalets.approved')}
      </Badge>
    );
  }
  return <Badge tone="warning">{t('chalets.pending')}</Badge>;
}
