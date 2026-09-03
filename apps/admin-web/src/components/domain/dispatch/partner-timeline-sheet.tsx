'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DateTime } from '@/components/ui/date-time';
import { Sheet } from '@/components/ui/dialog';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { adminApi } from '@/lib/api/endpoints/admin';
import { queryKeys } from '@/lib/query-keys';

export function PartnerTimelineSheet({ partnerId, onClose }: { partnerId: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const query = useQuery({ queryKey: queryKeys.dispatch.partnerTimeline(partnerId ?? ''), queryFn: () => adminApi.partnerTimeline(partnerId as string), enabled: !!partnerId });
  return (
    <Sheet open={!!partnerId} onOpenChange={(o) => !o && onClose()} title={t('dispatch.partnerTimeline')} description={query.data ? `${query.data.fullName ?? query.data.phone} · ${query.data.phone}` : undefined}>
      {query.isPending ? (
        <SkeletonRows rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusPill group="availability" value={query.data.availability} />
            <span className="text-text-secondary">{t('liveMap.lastSeen')}: <DateTime value={query.data.lastHeartbeatAt} mode="relative" /></span>
            {query.data.currentJobId ? <Link className="text-primary hover:underline" href={`/jobs/${query.data.currentJobId}`}>{t('liveMap.activeJob')}</Link> : null}
            <Link className="ms-auto text-primary hover:underline" href={`/partners/${query.data.partnerId}`}>{t('common.openDetails')}</Link>
          </div>
          {query.data.entries.length === 0 ? (
            <EmptyState title={t('dispatch.noTimeline')} />
          ) : (
            <ol className="relative ms-2 border-s border-border ps-4">
              {query.data.entries.map((e, i) => (
                <li key={i} className="relative mb-4">
                  <span className={`absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-pill ${e.kind === 'ASSIGNMENT' ? 'bg-accent' : 'bg-primary'}`} aria-hidden />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={e.kind === 'ASSIGNMENT' ? 'accent' : 'brand'}>{e.kind === 'ASSIGNMENT' ? t('dispatch.assignment') : t('jobs.event')}</Badge>
                    <span className="font-mono text-text-secondary">{e.type}</span>
                    <DateTime value={e.at} className="ms-auto text-text-tertiary" />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    <Link className="font-semibold text-primary hover:underline" href={`/jobs/${e.jobId}`}>{e.jobNumber}</Link> · <StatusPill group="jobType" value={e.jobType} />
                    {e.toStatus ? <> · <StatusPill group="jobStatus" value={e.toStatus} /></> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Sheet>
  );
}
