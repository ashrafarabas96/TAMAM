'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { type CampaignStatusActionInput, campaignStatusActionSchema } from '@tamam/validation';
import { Permission } from '@tamam/shared-types';

import { BannerPreview, PhoneFrame } from '@/components/domain/campaigns/banner-preview';
import { CampaignForm } from '@/components/domain/campaigns/campaign-form';
import { TargetingTester } from '@/components/domain/campaigns/targeting-tester';
import { BarsChart, TimeSeriesChart } from '@/components/charts/charts';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateTime } from '@/components/ui/date-time';
import { Identifier } from '@/components/ui/misc';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { campaignsApi } from '@/lib/api/endpoints/campaigns';
import { formatNumber, formatPercent } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';

type StatusAction = CampaignStatusActionInput['action'];
const ACTIONS: StatusAction[] = ['PUBLISH', 'PAUSE', 'RESUME', 'END', 'ARCHIVE'];

export default function CampaignDetailPage() {
  return (
    <RequirePermission anyOf={[Permission.CAMPAIGNS_READ]}>
      <CampaignDetail />
    </RequirePermission>
  );
}

function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, enumLabel, locale } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const zones = useZoneOptions();
  const [action, setAction] = useState<StatusAction | null>(null);
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>(locale);

  const campaign = useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => campaignsApi.get(id),
  });
  const statusMutation = useMutation({
    mutationFn: (input: CampaignStatusActionInput) =>
      campaignsApi.changeStatus(id, campaignStatusActionSchema.parse(input)),
    onSuccess: async () => {
      toast.success(t('campaigns.statusChanged'));
      setAction(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
    onError: (e) => toast.fromError(e),
  });

  if (campaign.isPending) return <SkeletonCard />;
  if (campaign.isError)
    return <ErrorState error={campaign.error} onRetry={() => void campaign.refetch()} />;
  const c = campaign.data;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.campaigns'), href: '/campaigns' }, { label: c.name }]}
        title={c.name}
        badge={<StatusPill group="campaignStatus" value={c.status} />}
        description={c.description ?? undefined}
        actions={
          <Can anyOf={[Permission.CAMPAIGNS_MANAGE]}>
            <div className="flex flex-wrap gap-1">
              {ACTIONS.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={
                    a === 'PUBLISH'
                      ? 'accent'
                      : a === 'END' || a === 'ARCHIVE'
                        ? 'danger-soft'
                        : 'outline'
                  }
                  onClick={() => setAction(a)}
                >
                  {enumLabel('campaignAction', a)}
                </Button>
              ))}
            </div>
          </Can>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('campaigns.impressions')}
          value={formatNumber(c.stats.impressions, locale)}
          hint={t('campaigns.uniqueImpressions', {
            count: formatNumber(c.stats.uniqueImpressions, locale),
          })}
        />
        <KpiCard
          label={t('campaigns.clicks')}
          value={formatNumber(c.stats.clicks, locale)}
          tone="info"
        />
        <KpiCard
          label={t('campaigns.ctr')}
          value={formatPercent(c.stats.ctr, locale, 2)}
          tone="accent"
        />
        <KpiCard
          label={t('campaigns.conversions')}
          value={formatNumber(c.stats.conversions, locale)}
          tone="success"
          hint={t('campaigns.conversionsHint')}
        />
      </div>

      <Tabs
        items={[
          {
            value: 'overview',
            label: t('campaigns.overview'),
            content: (
              <div className="space-y-4">
                <Card title={t('campaigns.details')}>
                  <KeyValue
                    columns={3}
                    items={[
                      {
                        label: t('campaigns.schedule'),
                        value: (
                          <>
                            <DateTime value={c.startsAt} /> →{' '}
                            {c.endsAt ? <DateTime value={c.endsAt} /> : t('campaigns.openEnded')}
                          </>
                        ),
                      },
                      {
                        label: t('campaigns.frequencyCap'),
                        value: c.frequencyCapPerDay
                          ? `${c.frequencyCapPerDay} / ${t('common.day')}`
                          : t('common.none'),
                      },
                      {
                        label: t('campaigns.rolloutPercent'),
                        value: `${c.targeting.rolloutPercent}%`,
                      },
                      {
                        label: t('campaigns.audiences'),
                        value: c.targeting.audiences
                          .map((a) => enumLabel('bannerAudience', a))
                          .join('، '),
                      },
                      {
                        label: t('campaigns.zones'),
                        value: c.targeting.zoneIds.length
                          ? c.targeting.zoneIds.map((z) => zones.nameOf(z)).join('، ')
                          : t('common.all'),
                      },
                      {
                        label: t('common.language'),
                        value: c.targeting.languages.length
                          ? c.targeting.languages.join('، ').toUpperCase()
                          : t('common.all'),
                      },
                      {
                        label: t('campaigns.platforms'),
                        value: c.targeting.platforms.length
                          ? c.targeting.platforms.join('، ')
                          : t('common.all'),
                      },
                      {
                        label: t('campaigns.newCustomersOnly'),
                        value: c.targeting.newCustomersOnly ? t('common.yes') : t('common.no'),
                      },
                      {
                        label: t('campaigns.completedJobsRange'),
                        value: `${c.targeting.minCompletedJobs ?? '—'} … ${c.targeting.maxCompletedJobs ?? '—'}`,
                      },
                      {
                        label: t('campaigns.serviceInterest'),
                        value: c.targeting.serviceTypeInterest.length
                          ? c.targeting.serviceTypeInterest.join('، ')
                          : t('common.all'),
                      },
                      {
                        label: t('campaigns.publishedAt'),
                        value: <DateTime value={c.publishedAt} />,
                      },
                      { label: t('common.id'), value: <Identifier value={c.id} short={false} /> },
                    ]}
                  />
                </Card>
                <Card
                  title={t('campaigns.banners')}
                  actions={
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={previewLang === 'ar' ? 'primary' : 'outline'}
                        onClick={() => setPreviewLang('ar')}
                      >
                        {t('common.arabic')}
                      </Button>
                      <Button
                        size="sm"
                        variant={previewLang === 'en' ? 'primary' : 'outline'}
                        onClick={() => setPreviewLang('en')}
                      >
                        {t('common.english')}
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {c.banners.map((b) => (
                      <div key={b.id} className="space-y-2">
                        <PhoneFrame>
                          <BannerPreview
                            language={previewLang}
                            value={{
                              placement: b.placement,
                              theme: b.creative.theme,
                              headline: b.creative.headline,
                              subheadline: b.creative.subheadline,
                              ctaLabel: b.creative.ctaLabel,
                              badge: b.creative.badge,
                              imageUrl:
                                previewLang === 'ar'
                                  ? b.creative.imageUrl.ar
                                  : b.creative.imageUrl.en,
                            }}
                          />
                        </PhoneFrame>
                        <p className="flex flex-wrap justify-center gap-1 text-[11px]">
                          <Badge tone={b.isActive ? 'success' : 'neutral'}>
                            {b.isActive ? t('common.active') : t('common.inactive')}
                          </Badge>
                          <Badge tone="neutral">
                            {t('campaigns.priority')}: {b.priority}
                          </Badge>
                          {b.actionType !== 'NONE' ? (
                            <Badge tone="brand">
                              {enumLabel('bannerActionType', b.actionType)}: {b.actionValue}
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            value: 'analytics',
            label: t('campaigns.analytics'),
            content: <AnalyticsTab campaignId={c.id} />,
          },
          {
            value: 'edit',
            label: t('common.edit'),
            content: (
              <Can anyOf={[Permission.CAMPAIGNS_MANAGE]}>
                <CampaignForm campaign={c} />
              </Can>
            ),
          },
          {
            value: 'tester',
            label: t('campaigns.tester'),
            content: <TargetingTester highlightCampaignId={c.id} />,
          },
        ]}
      />

      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={action ? enumLabel('campaignAction', action) : ''}
        description={t('campaigns.statusConfirm', { name: c.name })}
        tone={action === 'END' || action === 'ARCHIVE' ? 'danger' : 'primary'}
        loading={statusMutation.isPending}
        requireReason={action === 'END' || action === 'ARCHIVE'}
        reasonMinLength={3}
        onConfirm={(reason) => {
          if (action) statusMutation.mutate({ action, ...(reason ? { reason } : {}) });
        }}
      />
    </div>
  );
}

function AnalyticsTab({ campaignId }: { campaignId: string }) {
  const { t, locale, enumLabel } = useI18n();
  const range = useMemo(
    () => ({ from: subDays(new Date(), 30).toISOString(), to: new Date().toISOString() }),
    [],
  );
  const stats = useQuery({
    queryKey: queryKeys.campaigns.stats(campaignId, range),
    queryFn: () => campaignsApi.stats(campaignId, range),
  });
  if (stats.isPending) return <SkeletonCard />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const byDay = stats.data.byDay.map((d) => ({
    date: d.date.slice(5),
    impressions: d.impressions,
    clicks: d.clicks,
  }));
  const byPlacement = stats.data.byPlacement.map((p) => ({
    placement: enumLabel('bannerPlacement', p.placement),
    impressions: p.impressions,
    clicks: p.clicks,
    ctr: p.ctr,
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('campaigns.impressions')}
          value={formatNumber(stats.data.impressions, locale)}
        />
        <KpiCard
          label={t('campaigns.clicks')}
          value={formatNumber(stats.data.clicks, locale)}
          tone="info"
        />
        <KpiCard
          label={t('campaigns.dismissals')}
          value={formatNumber(stats.data.dismissals, locale)}
          tone="neutral"
        />
        <KpiCard
          label={t('campaigns.ctr')}
          value={formatPercent(stats.data.ctr, locale, 2)}
          tone="accent"
        />
      </div>
      <Card title={t('campaigns.dailyPerformance')}>
        <TimeSeriesChart
          data={byDay}
          xKey="date"
          series={[
            { key: 'impressions', label: t('campaigns.impressions'), slot: 0 },
            { key: 'clicks', label: t('campaigns.clicks'), slot: 2 },
          ]}
          tableCaption={t('campaigns.dailyPerformance')}
        />
      </Card>
      <Card title={t('campaigns.byPlacement')}>
        <BarsChart
          data={byPlacement}
          xKey="placement"
          series={[
            { key: 'impressions', label: t('campaigns.impressions'), slot: 0 },
            { key: 'clicks', label: t('campaigns.clicks'), slot: 1 },
          ]}
          tableCaption={t('campaigns.byPlacement')}
        />
      </Card>
    </div>
  );
}
