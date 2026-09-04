'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { type LiveMapJobDto, type LiveMapPartnerDto, Permission } from '@tamam/shared-types';

import { RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTime } from '@/components/ui/date-time';
import { Checkbox } from '@/components/ui/checkbox';
import { Identifier } from '@/components/ui/misc';
import { KeyValue } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import type { AdminMapUpdate } from '@/lib/api/types';
import { trackingApi } from '@/lib/api/endpoints/tracking';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';
import { useAdminSocket } from '@/lib/socket/admin-socket';

import type { MapJobPoint, MapPartnerPoint } from '@/components/domain/map/live-map-view';

const LiveMapView = dynamic(
  () => import('@/components/domain/map/live-map-view').then((m) => m.LiveMapView),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

const STALE_AFTER_MS = 120_000;

export default function LiveMapPage() {
  return (
    <RequirePermission anyOf={[Permission.TRACKING_VIEW_LIVE_MAP]}>
      <LiveMap />
    </RequirePermission>
  );
}

function LiveMap() {
  const { t, enumLabel } = useI18n();
  const [zoneId, setZoneId] = useState('');
  const [showPartners, setShowPartners] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [selected, setSelected] = useState<{ kind: 'partner' | 'job'; id: string } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [overrides, setOverrides] = useState<
    Record<
      string,
      Partial<LiveMapPartnerDto> & { location: { lat: number; lng: number }; lastSeenAt: string }
    >
  >({});
  const [jobStatus, setJobStatus] = useState<Record<string, string>>({});
  const [sosJobs, setSosJobs] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<AdminMapUpdate[]>([]);
  const zones = useZoneOptions(true, t('common.allZones'));
  const zone = zones.zones.find((z) => z.id === zoneId);

  const snapshot = useQuery({
    queryKey: queryKeys.liveMap({ zoneId }),
    queryFn: () =>
      trackingApi.liveMap({
        ...(zoneId ? { zoneId } : {}),
        includePartners: true,
        includeJobs: true,
      }),
    refetchInterval: 30_000,
  });

  const onMapUpdate = useCallback((update: AdminMapUpdate) => {
    setEvents((prev) => [update, ...prev].slice(0, 60));
    if (update.kind === 'LOCATION' && update.partnerId) {
      const lat = Number(update.payload.lat);
      const lng = Number(update.payload.lng);
      const heading = typeof update.payload.heading === 'number' ? update.payload.heading : null;
      setOverrides((prev) => ({
        ...prev,
        [update.partnerId as string]: {
          location: { lat, lng },
          heading,
          lastSeenAt: update.at,
          activeJobId: update.jobId,
        },
      }));
    } else if (update.kind === 'JOB_STATUS' && update.jobId) {
      setJobStatus((prev) => ({ ...prev, [update.jobId as string]: String(update.payload.to) }));
    } else if (update.kind === 'SOS' && update.jobId) {
      setSosJobs((prev) => ({ ...prev, [update.jobId as string]: update.at }));
    }
  }, []);
  const { status: socketStatus } = useAdminSocket({ onMapUpdate }, { zoneId: zoneId || null });

  const partners = useMemo<MapPartnerPoint[]>(() => {
    if (!showPartners) return [];
    const now = Date.now();
    return (snapshot.data?.partners ?? []).map((p) => {
      const o = overrides[p.partnerId];
      const lastSeen = o?.lastSeenAt ?? p.lastSeenAt;
      return {
        id: p.partnerId,
        lat: o?.location.lat ?? p.location.lat,
        lng: o?.location.lng ?? p.location.lng,
        heading: o?.heading ?? p.heading,
        availability: p.availability,
        activeJobId: o?.activeJobId ?? p.activeJobId,
        stale: now - new Date(lastSeen).getTime() > STALE_AFTER_MS,
      };
    });
  }, [snapshot.data, overrides, showPartners]);

  const jobs = useMemo<MapJobPoint[]>(() => {
    if (!showJobs) return [];
    return (snapshot.data?.jobs ?? []).map((j) => ({
      id: j.jobId,
      number: j.number,
      type: j.type,
      status: jobStatus[j.jobId] ?? j.status,
      lat: j.pickup.lat,
      lng: j.pickup.lng,
      destination: j.destination,
      sos: !!sosJobs[j.jobId],
    }));
  }, [snapshot.data, jobStatus, sosJobs, showJobs]);

  const selectedPartner: (LiveMapPartnerDto & { stale: boolean }) | null = useMemo(() => {
    if (selected?.kind !== 'partner') return null;
    const base = snapshot.data?.partners.find((p) => p.partnerId === selected.id);
    const point = partners.find((p) => p.id === selected.id);
    return base
      ? {
          ...base,
          location: point ? { lat: point.lat, lng: point.lng } : base.location,
          stale: point?.stale ?? false,
        }
      : null;
  }, [selected, snapshot.data, partners]);
  const selectedJob: LiveMapJobDto | null = useMemo(
    () =>
      selected?.kind === 'job'
        ? (snapshot.data?.jobs.find((j) => j.jobId === selected.id) ?? null)
        : null,
    [selected, snapshot.data],
  );

  const selectPartner = useCallback((id: string) => setSelected({ kind: 'partner', id }), []);
  const selectJob = useCallback((id: string) => setSelected({ kind: 'job', id }), []);
  const focusOn = (lat: number, lng: number) => setFocus({ lat, lng });

  const online = partners.filter((p) => p.availability === 'ONLINE').length;
  const busy = partners.filter((p) => p.availability === 'BUSY').length;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold text-text-primary">{t('liveMap.title')}</h1>
        <Badge tone={socketStatus === 'connected' ? 'success' : 'warning'}>
          {socketStatus === 'connected' ? t('dashboard.live') : t('dashboard.polling')}
        </Badge>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          <Select
            value={zoneId}
            onValueChange={(v) => {
              setZoneId(v);
              setSelected(null);
            }}
            options={zones.options}
            placeholder={t('common.allZones')}
            className="w-56"
            aria-label={t('common.zone')}
          />
          <Checkbox
            checked={showPartners}
            onCheckedChange={setShowPartners}
            label={t('liveMap.showPartners')}
          />
          <Checkbox
            checked={showJobs}
            onCheckedChange={setShowJobs}
            label={t('liveMap.showJobs')}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void snapshot.refetch()}
            loading={snapshot.isFetching}
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="brand">{t('liveMap.partnersOnline', { count: online })}</Badge>
        <Badge tone="warning">{t('liveMap.partnersBusy', { count: busy })}</Badge>
        <Badge tone="info">{t('liveMap.activeJobs', { count: jobs.length })}</Badge>
        {Object.keys(sosJobs).length > 0 ? (
          <Badge tone="danger">
            {t('liveMap.sosActive', { count: Object.keys(sosJobs).length })}
          </Badge>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_340px]">
        <div className="card relative min-h-[420px] overflow-hidden p-0">
          {snapshot.isError ? (
            <ErrorState error={snapshot.error} onRetry={() => void snapshot.refetch()} />
          ) : (
            <LiveMapView
              partners={partners}
              jobs={jobs}
              polygon={zone?.polygon ?? null}
              focus={focus}
              onSelectPartner={selectPartner}
              onSelectJob={selectJob}
            />
          )}
        </div>
        <aside className="card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">
              {selectedPartner
                ? t('liveMap.partnerPanel')
                : selectedJob
                  ? t('liveMap.jobPanel')
                  : t('liveMap.eventFeed')}
            </h2>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-4 text-sm">
            {selectedPartner ? (
              <div className="space-y-3">
                <KeyValue
                  columns={1}
                  items={[
                    {
                      label: t('common.id'),
                      value: <Identifier value={selectedPartner.partnerId} />,
                    },
                    {
                      label: t('partners.availability'),
                      value: (
                        <span className="flex gap-1">
                          <StatusPill group="availability" value={selectedPartner.availability} />
                          {selectedPartner.stale ? (
                            <Badge tone="danger">{t('liveMap.stale')}</Badge>
                          ) : null}
                        </span>
                      ),
                    },
                    {
                      label: t('partners.roles'),
                      value: selectedPartner.roles
                        .map((r) => enumLabel('partnerRole', r))
                        .join(', '),
                    },
                    {
                      label: t('liveMap.lastSeen'),
                      value: (
                        <DateTime
                          value={
                            overrides[selectedPartner.partnerId]?.lastSeenAt ??
                            selectedPartner.lastSeenAt
                          }
                          mode="relative"
                        />
                      ),
                    },
                    {
                      label: t('liveMap.activeJob'),
                      value: selectedPartner.activeJobId ? (
                        <Link
                          className="text-primary underline-offset-2 hover:underline"
                          href={`/jobs/${selectedPartner.activeJobId}`}
                        >
                          {selectedPartner.activeJobId.slice(0, 8)}…
                        </Link>
                      ) : (
                        '—'
                      ),
                    },
                  ]}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      focusOn(selectedPartner.location.lat, selectedPartner.location.lng)
                    }
                  >
                    {t('liveMap.center')}
                  </Button>
                  <Link
                    href={`/partners/${selectedPartner.partnerId}`}
                    className="inline-flex h-9 items-center rounded-button bg-primary px-3 text-xs font-semibold text-text-on-brand"
                  >
                    {t('common.openDetails')}
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            ) : selectedJob ? (
              <div className="space-y-3">
                <KeyValue
                  columns={1}
                  items={[
                    { label: t('jobs.number'), value: selectedJob.number },
                    {
                      label: t('common.type'),
                      value: <StatusPill group="jobType" value={selectedJob.type} />,
                    },
                    {
                      label: t('common.status'),
                      value: (
                        <StatusPill
                          group="jobStatus"
                          value={jobStatus[selectedJob.jobId] ?? selectedJob.status}
                        />
                      ),
                    },
                    {
                      label: t('jobs.partner'),
                      value: selectedJob.partnerId ? (
                        <Link
                          className="text-primary hover:underline"
                          href={`/partners/${selectedJob.partnerId}`}
                        >
                          {selectedJob.partnerId.slice(0, 8)}…
                        </Link>
                      ) : (
                        t('jobs.unassigned')
                      ),
                    },
                    {
                      label: t('common.createdAt'),
                      value: <DateTime value={selectedJob.createdAt} />,
                    },
                  ]}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => focusOn(selectedJob.pickup.lat, selectedJob.pickup.lng)}
                  >
                    {t('liveMap.center')}
                  </Button>
                  <Link
                    href={`/jobs/${selectedJob.jobId}`}
                    className="inline-flex h-9 items-center rounded-button bg-primary px-3 text-xs font-semibold text-text-on-brand"
                  >
                    {t('common.openDetails')}
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            ) : events.length === 0 ? (
              <p className="text-xs text-text-secondary">{t('liveMap.noEvents')}</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge
                        tone={
                          e.kind === 'SOS'
                            ? 'danger'
                            : e.kind === 'JOB_STATUS'
                              ? 'brand'
                              : e.kind === 'OFFER'
                                ? 'info'
                                : 'neutral'
                        }
                      >
                        {t(`liveMap.event.${e.kind}` as 'liveMap.event.LOCATION')}
                      </Badge>
                      <DateTime value={e.at} mode="relative" className="text-text-tertiary" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-text-secondary">
                      {e.jobId ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => selectJob(e.jobId as string)}
                        >
                          {t('jobs.job')} {e.jobId.slice(0, 8)}
                        </button>
                      ) : null}
                      {e.partnerId ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => selectPartner(e.partnerId as string)}
                        >
                          {t('jobs.partner')} {e.partnerId.slice(0, 8)}
                        </button>
                      ) : null}
                      {e.kind === 'JOB_STATUS' ? (
                        <span>
                          {String(e.payload.from)} → {String(e.payload.to)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
