'use client';

import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import {
  AlertOctagon,
  Car,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck2,
  Gavel,
  Headset,
  Radio,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { type OpsDashboardDto, Permission } from '@tamam/shared-types';

import { BarsChart, TimeSeriesChart } from '@/components/charts/charts';
import { JOB_TYPE_SLOT } from '@/components/charts/chart-theme';
import { RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { DateTime } from '@/components/ui/date-time';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useI18n } from '@/i18n';
import { adminApi } from '@/lib/api/endpoints/admin';
import { analyticsApi } from '@/lib/api/endpoints/analytics';
import { formatDuration } from '@/lib/format/date';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';
import { useAdminSocket } from '@/lib/socket/admin-socket';

const KPI_DAYS = 14;

export default function DashboardPage() {
  return (
    <RequirePermission anyOf={[Permission.ANALYTICS_READ]}>
      <Dashboard />
    </RequirePermission>
  );
}

function Dashboard() {
  const { t, locale, enumLabel } = useI18n();
  const [live, setLive] = useState<OpsDashboardDto | null>(null);
  const overview = useQuery({
    queryKey: queryKeys.overview,
    queryFn: adminApi.overview,
    refetchInterval: 60_000,
  });
  const range = useMemo(
    () => ({ from: subDays(new Date(), KPI_DAYS).toISOString(), to: new Date().toISOString() }),
    [],
  );
  const kpis = useQuery({
    queryKey: queryKeys.kpis(range),
    queryFn: () => analyticsApi.kpis(range),
    staleTime: 5 * 60_000,
  });
  const { status: socketStatus } = useAdminSocket({ onMetrics: setLive });

  const dashboard = live ?? overview.data?.dashboard ?? null;
  const queues = overview.data?.queues;

  const kpiRows = useMemo(
    () =>
      (kpis.data ?? []).map((k) => ({
        date: k.date.slice(5),
        created: k.jobsCreated,
        completed: k.jobsCompleted,
        cancelled: k.jobsCancelled,
        gmv: k.gmv.amount,
        revenue: k.platformRevenue.amount,
        currency: k.gmv.currency,
      })),
    [kpis.data],
  );
  const currency = kpis.data?.[0]?.gmv.currency ?? 'ILS';
  const byType = useMemo(
    () =>
      (dashboard?.byJobType ?? []).map((row) => ({
        type: enumLabel('jobType', row.type),
        active: row.active,
        completedToday: row.completedToday,
        slot: JOB_TYPE_SLOT[row.type] ?? 3,
      })),
    [dashboard, enumLabel],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        badge={
          <Badge tone={socketStatus === 'connected' ? 'success' : 'warning'}>
            <Radio className="h-3 w-3" aria-hidden />{' '}
            {socketStatus === 'connected' ? t('dashboard.live') : t('dashboard.polling')}
          </Badge>
        }
        actions={
          dashboard ? (
            <span className="text-xs text-text-tertiary">
              {t('dashboard.updatedAt')} <DateTime value={dashboard.generatedAt} mode="relative" />
            </span>
          ) : null
        }
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : null}

      <section
        aria-label={t('dashboard.kpis')}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {!dashboard ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              icon={Car}
              label={t('dashboard.activeJobs')}
              value={formatNumber(dashboard.activeJobs, locale)}
              hint={t('dashboard.searchingJobs', { count: dashboard.searchingJobs })}
            />
            <KpiCard
              icon={CheckCircle2}
              tone="success"
              label={t('dashboard.completedToday')}
              value={formatNumber(dashboard.completedToday, locale)}
            />
            <KpiCard
              icon={XCircle}
              tone="danger"
              label={t('dashboard.cancelledToday')}
              value={formatNumber(dashboard.cancelledToday, locale)}
            />
            <KpiCard
              icon={Users}
              tone="info"
              label={t('dashboard.onlinePartners')}
              value={formatNumber(dashboard.onlinePartners, locale)}
              hint={t('dashboard.availablePartners', { count: dashboard.availablePartners })}
            />
            <KpiCard
              icon={Coins}
              tone="accent"
              label={t('dashboard.grossBookings')}
              value={formatMoney(dashboard.grossBookingsToday, { locale })}
            />
            <KpiCard
              icon={Wallet}
              tone="accent"
              label={t('dashboard.platformRevenue')}
              value={formatMoney(dashboard.platformRevenueToday, { locale })}
            />
            <KpiCard
              icon={Clock}
              tone="neutral"
              label={t('dashboard.avgDispatch')}
              value={formatDuration(dashboard.averageDispatchSeconds)}
              hint={t('dashboard.avgPickupEta', {
                value: formatDuration(dashboard.averagePickupEtaSeconds),
              })}
            />
            <KpiCard
              icon={Headset}
              tone="neutral"
              label={t('dashboard.openTickets')}
              value={formatNumber(dashboard.openSupportTickets, locale)}
            />
          </>
        )}
      </section>

      {queues ? (
        <section
          aria-label={t('dashboard.queues')}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <QueueLink
            href="/jobs?tab=sos"
            icon={AlertOctagon}
            label={t('dashboard.openSos')}
            value={queues.openSosAlerts}
            danger={queues.openSosAlerts > 0}
          />
          <QueueLink
            href="/support"
            icon={Headset}
            label={t('dashboard.openTickets')}
            value={queues.openSupportTickets}
          />
          <QueueLink
            href="/disputes"
            icon={Gavel}
            label={t('dashboard.openDisputes')}
            value={queues.openDisputes}
          />
          <QueueLink
            href="/partners?verificationStatus=PENDING"
            icon={Users}
            label={t('dashboard.pendingVerifications')}
            value={queues.pendingPartnerVerifications}
          />
          <QueueLink
            href="/partners?tab=documents"
            icon={FileCheck2}
            label={t('dashboard.pendingDocuments')}
            value={queues.pendingPartnerDocuments}
          />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={t('dashboard.jobsTrend', { days: KPI_DAYS })} className="xl:col-span-2">
          {kpis.isPending ? (
            <SkeletonCard />
          ) : kpis.isError ? (
            <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
          ) : (
            <TimeSeriesChart
              data={kpiRows}
              xKey="date"
              series={[
                { key: 'created', label: t('dashboard.series.created'), slot: 0 },
                { key: 'completed', label: t('dashboard.series.completed'), slot: 2 },
                { key: 'cancelled', label: t('dashboard.series.cancelled'), slot: 3 },
              ]}
              tableCaption={t('dashboard.jobsTrend', { days: KPI_DAYS })}
            />
          )}
        </Card>
        <Card title={t('dashboard.byJobType')}>
          {!dashboard ? (
            <SkeletonCard />
          ) : (
            <BarsChart
              data={byType}
              xKey="type"
              series={[
                { key: 'active', label: t('dashboard.series.active'), slot: 0 },
                { key: 'completedToday', label: t('dashboard.series.completedToday'), slot: 1 },
              ]}
              height={240}
              tableCaption={t('dashboard.byJobType')}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('dashboard.gmvTrend')}>
          {kpis.isPending ? (
            <SkeletonCard />
          ) : (
            <TimeSeriesChart
              kind="area"
              data={kpiRows}
              xKey="date"
              series={[
                { key: 'gmv', label: t('dashboard.series.gmv'), slot: 0 },
                { key: 'revenue', label: t('dashboard.series.revenue'), slot: 1 },
              ]}
              valueFormatter={(v) => formatMoney({ amount: v, currency }, { locale })}
              tableCaption={t('dashboard.gmvTrend')}
            />
          )}
        </Card>
        <Card title={t('dashboard.partnerUtilization')}>
          {kpis.isPending ? (
            <SkeletonCard />
          ) : (
            <TimeSeriesChart
              data={(kpis.data ?? []).map((k) => ({
                date: k.date.slice(5),
                utilization: k.partnerUtilization ?? 0,
                activePartners: k.activePartners,
              }))}
              xKey="date"
              series={[{ key: 'utilization', label: t('dashboard.series.utilization'), slot: 0 }]}
              valueFormatter={(v) => formatPercent(v, locale)}
              tableCaption={t('dashboard.partnerUtilization')}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function QueueLink({
  href,
  icon: Icon,
  label,
  value,
  danger,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary ${danger ? 'border-danger/50 bg-danger-soft/40' : ''}`}
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
        <Icon className={`h-4 w-4 ${danger ? 'text-danger' : 'text-primary'}`} aria-hidden />{' '}
        {label}
      </span>
      <span
        className={`tabular text-lg font-extrabold ${danger ? 'text-danger' : 'text-text-primary'}`}
      >
        {value}
      </span>
    </Link>
  );
}
