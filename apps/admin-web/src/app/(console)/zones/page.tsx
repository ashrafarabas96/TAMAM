'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Permission, type ServiceZoneDto } from '@tamam/shared-types';

import { ZoneDialog } from '@/components/domain/zones/zone-dialog';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Identifier } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useI18n } from '@/i18n';
import { zonesApi } from '@/lib/api/endpoints/zones';
import { queryKeys } from '@/lib/query-keys';

const PolygonEditor = dynamic(
  () => import('@/components/domain/zones/polygon-editor').then((m) => m.PolygonEditor),
  { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> },
);

export default function ZonesPage() {
  return (
    <RequirePermission anyOf={[Permission.ZONES_READ]}>
      <ZonesScreen />
    </RequirePermission>
  );
}

function ZonesScreen() {
  const { t, localized } = useI18n();
  const [editing, setEditing] = useState<ServiceZoneDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [rulesFor, setRulesFor] = useState<ServiceZoneDto | null>(null);
  const [preview, setPreview] = useState<ServiceZoneDto | null>(null);
  const zones = useQuery({ queryKey: queryKeys.zones.list, queryFn: zonesApi.list });

  const columns: Column<ServiceZoneDto>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (z) => (
        <span>
          <span className="block font-medium">{localized(z.name)}</span>
          <span className="block font-mono text-[11px] text-text-tertiary" dir="ltr">
            {z.code}
          </span>
        </span>
      ),
    },
    { key: 'city', header: t('zones.city'), cell: (z) => z.city },
    {
      key: 'currency',
      header: t('common.currency'),
      cell: (z) => <Badge tone="accent">{z.currency}</Badge>,
    },
    {
      key: 'timezone',
      header: t('zones.timezone'),
      cell: (z) => (
        <span className="text-xs" dir="ltr">
          {z.timezone}
        </span>
      ),
    },
    {
      key: 'hours',
      header: t('zones.operatingHours'),
      cell: (z) => (
        <span className="text-xs text-text-secondary">
          {z.operatingHours.filter((h) => !h.isClosed).length}/7 {t('zones.openDays')}
        </span>
      ),
    },
    {
      key: 'center',
      header: t('zones.center'),
      cell: (z) => (
        <span className="text-xs" dir="ltr">
          {z.center.lat.toFixed(4)}, {z.center.lng.toFixed(4)}
        </span>
      ),
    },
    {
      key: 'active',
      header: t('common.active'),
      cell: (z) => (
        <Badge tone={z.isActive ? 'success' : 'neutral'}>
          {z.isActive ? t('common.yes') : t('common.no')}
        </Badge>
      ),
    },
    { key: 'id', header: t('common.id'), cell: (z) => <Identifier value={z.id} /> },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      cell: (z) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setPreview(z)}>
            {t('zones.viewMap')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRulesFor(z)}>
            {t('zones.rules')}
          </Button>
          <Can anyOf={[Permission.ZONES_MANAGE]}>
            <Button size="sm" variant="outline" onClick={() => setEditing(z)}>
              {t('common.edit')}
            </Button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('zones.title')}
        description={t('zones.subtitle')}
        actions={
          <Can anyOf={[Permission.ZONES_MANAGE]}>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('zones.new')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        rows={zones.data ?? []}
        rowKey={(z) => z.id}
        isLoading={zones.isPending}
        error={zones.error}
        onRetry={() => void zones.refetch()}
        emptyTitle={t('zones.empty')}
        emptyDescription={t('zones.emptyDescription')}
      />
      <ZoneDialog
        zone={editing}
        open={!!editing || creating}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
      />
      <Dialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        size="lg"
        title={preview ? localized(preview.name) : ''}
        footer={
          <Button variant="ghost" onClick={() => setPreview(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {preview ? (
          <PolygonEditor
            className="h-[320px]"
            value={preview.polygon}
            onChange={() => undefined}
            readOnly
          />
        ) : null}
      </Dialog>
      <ZoneRulesDialog zone={rulesFor} onClose={() => setRulesFor(null)} />
    </div>
  );
}

function ZoneRulesDialog({ zone, onClose }: { zone: ServiceZoneDto | null; onClose: () => void }) {
  const { t, localized } = useI18n();
  const rules = useQuery({
    queryKey: queryKeys.zones.rules(zone?.id ?? ''),
    queryFn: () => zonesApi.rules(zone?.id as string),
    enabled: !!zone,
  });
  return (
    <Dialog
      open={!!zone}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('zones.rules')}
      description={zone ? localized(zone.name) : undefined}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {rules.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => void rules.refetch()} />
      ) : rules.data.length === 0 ? (
        <EmptyState title={t('zones.noRules')} description={t('zones.noRulesHint')} />
      ) : (
        <ul className="space-y-2">
          {rules.data.map((rule) => (
            <li key={rule.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={rule.isEnabled ? 'success' : 'danger'}>
                  {rule.isEnabled ? t('common.enabled') : t('common.disabled')}
                </Badge>
                {rule.serviceType ? <Badge tone="brand">{rule.serviceType.code}</Badge> : null}
                {rule.category ? (
                  <Badge tone="info">
                    {rule.category.nameAr} / {rule.category.nameEn}
                  </Badge>
                ) : null}
                {rule.vehicleType ? <Badge tone="accent">{rule.vehicleType.code}</Badge> : null}
              </div>
              {rule.hours.length > 0 ? (
                <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                  {rule.hours
                    .map(
                      (h) => `${h.dayOfWeek}: ${h.isClosed ? '—' : `${h.opensAt}–${h.closesAt}`}`,
                    )
                    .join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
