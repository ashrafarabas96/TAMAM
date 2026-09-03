'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { JobDto } from '@tamam/shared-types';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateTime } from '@/components/ui/date-time';
import { Sheet } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { dispatchApi } from '@/lib/api/endpoints/dispatch';
import { formatNumber } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';

const ROLE_FOR_TYPE: Record<string, 'DRIVER' | 'COURIER' | 'TECHNICIAN' | undefined> = { RIDE: 'DRIVER', DELIVERY: 'COURIER', HOME_SERVICE: 'TECHNICIAN' };

/** Nearby partners around the job's first stop + manual assignment with an audited reason. */
export function AssignSheet({ job, onClose }: { job: JobDto | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState(5000);
  const [role, setRole] = useState<string>(job ? (ROLE_FOR_TYPE[job.type] ?? '') : '');
  const [candidate, setCandidate] = useState<{ id: string; name: string } | null>(null);
  const stop = job?.stops[0];

  const nearby = useQuery({
    queryKey: queryKeys.dispatch.nearby({ jobId: job?.id, radius, role }),
    queryFn: () => dispatchApi.nearbyPartners({ lat: stop?.address.lat ?? 0, lng: stop?.address.lng ?? 0, radiusMeters: radius, jobId: job?.id, ...(role ? { role: role as 'DRIVER' } : {}), limit: 30 }),
    enabled: !!job && !!stop,
  });

  const assign = useMutation({
    mutationFn: (input: { partnerId: string; reason: string }) => dispatchApi.assign(job?.id ?? '', { partnerId: input.partnerId, reason: input.reason, version: job?.version ?? 0 }),
    onSuccess: async () => {
      toast.success(t('dispatch.assignSuccess'));
      setCandidate(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all }), queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })]);
      onClose();
    },
    onError: (error) => toast.fromError(error),
  });

  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()} title={t('dispatch.manualAssign')} description={job ? `${job.number} · ${stop?.address.formatted ?? ''}` : undefined} width="lg">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="radius">{t('dispatch.radius')}</Label>
          <Input id="radius" type="number" min={100} max={50000} step={500} value={radius} onChange={(e) => setRadius(Number(e.target.value) || 5000)} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="role">{t('partners.role')}</Label>
          <NativeSelect id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {['DRIVER', 'COURIER', 'TECHNICIAN', 'SERVICE_PROVIDER'].map((r) => (
              <option key={r} value={r}>{t(`enum.partnerRole.${r}` as 'enum.partnerRole.DRIVER')}</option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {!stop ? (
        <EmptyState title={t('dispatch.noStop')} />
      ) : nearby.isPending ? (
        <SkeletonRows rows={6} />
      ) : nearby.isError ? (
        <ErrorState error={nearby.error} onRetry={() => void nearby.refetch()} />
      ) : nearby.data.length === 0 ? (
        <EmptyState title={t('dispatch.noNearby')} description={t('dispatch.noNearbyHint')} />
      ) : (
        <ul className="space-y-2">
          {nearby.data.map((p) => (
            <li key={p.partnerId} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-text-primary">{p.fullName ?? p.phone}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <StatusPill group="availability" value={p.availability} />
                  <span dir="ltr">{formatNumber(p.distanceMeters, locale)} m</span>
                  <span>★ {p.rating.toFixed(1)}</span>
                  <span>{t('partners.completedJobs')}: {p.completedJobs}</span>
                  <DateTime value={p.lastSeenAt} mode="relative" />
                </p>
              </div>
              <Button size="sm" onClick={() => setCandidate({ id: p.partnerId, name: p.fullName ?? p.phone })} disabled={p.availability !== 'ONLINE' && p.availability !== 'BUSY'}>
                {t('dispatch.assign')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!candidate}
        onOpenChange={(o) => !o && setCandidate(null)}
        title={t('dispatch.confirmAssignTitle')}
        description={candidate ? t('dispatch.confirmAssignDescription', { partner: candidate.name, job: job?.number ?? '' }) : undefined}
        requireReason
        loading={assign.isPending}
        confirmLabel={t('dispatch.assign')}
        onConfirm={(reason) => candidate && assign.mutate({ partnerId: candidate.id, reason })}
      />
    </Sheet>
  );
}
