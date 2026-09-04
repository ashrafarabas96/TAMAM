'use client';

import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { JobType, PaymentMethod, Permission } from '@tamam/shared-types';
import type { ReportQueryInput } from '@tamam/validation';

import { BarsChart } from '@/components/charts/charts';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterBar } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { Card, PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { analyticsApi } from '@/lib/api/endpoints/analytics';
import type { ReportRow } from '@/lib/api/types';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/format/date';
import { formatNumber } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';
import { useEnumOptions } from '@/lib/query/use-enum-options';

const GROUPS: ReportQueryInput['groupBy'][] = [
  'day',
  'week',
  'month',
  'zone',
  'jobType',
  'partner',
  'paymentMethod',
];

export default function ReportsPage() {
  return (
    <RequirePermission anyOf={[Permission.ANALYTICS_READ]}>
      <ReportsScreen />
    </RequirePermission>
  );
}

function ReportsScreen() {
  const { t, locale, enumLabel } = useI18n();
  const toast = useToast();
  const zones = useZoneOptions(true, t('common.allZones'));
  const [from, setFrom] = useState(() => toDateTimeLocalValue(subDays(new Date(), 30)));
  const [to, setTo] = useState(() => toDateTimeLocalValue(new Date()));
  const [groupBy, setGroupBy] = useState<ReportQueryInput['groupBy']>('day');
  const [zoneId, setZoneId] = useState('');
  const [jobType, setJobType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const jobTypes = useEnumOptions(
    'jobType',
    [JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE],
    t('common.all'),
  );
  const methods = useEnumOptions('paymentMethod', PaymentMethod, t('common.all'));

  const query = useMemo(
    () => ({
      from: fromDateTimeLocalValue(from) ?? new Date().toISOString(),
      to: fromDateTimeLocalValue(to) ?? new Date().toISOString(),
      groupBy,
      ...(zoneId ? { zoneId } : {}),
      ...(jobType ? { jobType: jobType as 'RIDE' } : {}),
      ...(paymentMethod ? { paymentMethod: paymentMethod as 'CASH' } : {}),
    }),
    [from, to, groupBy, zoneId, jobType, paymentMethod],
  );
  const report = useQuery({
    queryKey: queryKeys.reports(query),
    queryFn: () => analyticsApi.report(query),
    staleTime: 60_000,
  });

  const download = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    try {
      const response = await analyticsApi.exportReport(query, format);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tamam-report-${groupBy}-${query.from.slice(0, 10)}_${query.to.slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.fromError(error, t('reports.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const labelFor = (key: string): string =>
    groupBy === 'zone'
      ? zones.nameOf(key)
      : groupBy === 'jobType'
        ? enumLabel('jobType', key)
        : groupBy === 'paymentMethod'
          ? enumLabel('paymentMethod', key)
          : key;
  const columns: Column<ReportRow>[] = [
    {
      key: 'key',
      header: t('reports.group'),
      cell: (r) => <span className="font-medium">{labelFor(r.key)}</span>,
    },
    {
      key: 'jobs',
      header: t('reports.jobs'),
      align: 'end',
      cell: (r) => <span className="tabular">{formatNumber(r.jobs, locale)}</span>,
    },
    {
      key: 'completed',
      header: t('reports.completed'),
      align: 'end',
      cell: (r) => <span className="tabular">{formatNumber(r.completed, locale)}</span>,
    },
    {
      key: 'cancelled',
      header: t('reports.cancelled'),
      align: 'end',
      cell: (r) => <span className="tabular text-danger">{formatNumber(r.cancelled, locale)}</span>,
    },
    { key: 'gmv', header: t('reports.gmv'), align: 'end', cell: (r) => <Money value={r.gmv} /> },
    {
      key: 'revenue',
      header: t('reports.revenue'),
      align: 'end',
      cell: (r) => <Money value={r.revenue} />,
    },
    {
      key: 'avgFare',
      header: t('reports.avgFare'),
      align: 'end',
      cell: (r) => <Money value={r.avgFare} />,
    },
  ];
  const chartData = (report.data?.rows ?? []).map((r) => ({
    key: labelFor(r.key),
    completed: r.completed,
    cancelled: r.cancelled,
    gmv: r.gmv.amount,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <Can anyOf={[Permission.REPORTS_EXPORT]}>
            <Button
              size="sm"
              variant="outline"
              loading={exporting === 'csv'}
              onClick={() => void download('csv')}
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={exporting === 'xlsx'}
              onClick={() => void download('xlsx')}
            >
              <Download className="h-4 w-4" aria-hidden />
              XLSX
            </Button>
          </Can>
        }
      />
      <FilterBar>
        <div>
          <Label htmlFor="from">{t('common.from')}</Label>
          <Input
            id="from"
            type="datetime-local"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="to">{t('common.to')}</Label>
          <Input
            id="to"
            type="datetime-local"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="groupBy">{t('reports.groupBy')}</Label>
          <Select
            id="groupBy"
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as ReportQueryInput['groupBy'])}
            options={GROUPS.map((g) => ({ value: g, label: enumLabel('reportGroupBy', g) }))}
            aria-label={t('reports.groupBy')}
          />
        </div>
        <div>
          <Label htmlFor="zone">{t('common.zone')}</Label>
          <Select
            id="zone"
            value={zoneId}
            onValueChange={setZoneId}
            options={zones.options}
            aria-label={t('common.zone')}
          />
        </div>
        <div>
          <Label htmlFor="jobType">{t('common.jobType')}</Label>
          <Select
            id="jobType"
            value={jobType}
            onValueChange={setJobType}
            options={jobTypes}
            aria-label={t('common.jobType')}
          />
        </div>
        <div>
          <Label htmlFor="method">{t('jobs.paymentMethod')}</Label>
          <Select
            id="method"
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            options={methods}
            aria-label={t('jobs.paymentMethod')}
          />
        </div>
      </FilterBar>
      {report.isPending ? (
        <SkeletonCard />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <Card title={t('reports.chartTitle')}>
            <BarsChart
              data={chartData}
              xKey="key"
              series={[
                { key: 'completed', label: t('reports.completed'), slot: 0 },
                { key: 'cancelled', label: t('reports.cancelled'), slot: 3 },
              ]}
              tableCaption={t('reports.chartTitle')}
            />
          </Card>
          <DataTable
            columns={columns}
            rows={report.data.rows}
            rowKey={(r) => r.key}
            emptyTitle={t('reports.empty')}
            footer={t('reports.footer', {
              currency: report.data.currency,
              count: report.data.rows.length,
            })}
          />
        </>
      )}
    </div>
  );
}
