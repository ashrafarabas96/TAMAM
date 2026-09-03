'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { BannerPlacement, JobType } from '@tamam/shared-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { campaignsApi, type CampaignPreviewInput } from '@/lib/api/endpoints/campaigns';
import { useZoneOptions } from '@/lib/query/reference-data';

import { BannerPreview, PhoneFrame } from './banner-preview';

/**
 * POST /admin/campaigns/preview — runs the real targeting engine against a synthetic viewer and
 * returns the banners that viewer would receive, so an operator can verify a campaign is reachable
 * before publishing it.
 */
export function TargetingTester({ highlightCampaignId }: { highlightCampaignId?: string }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const zones = useZoneOptions(true, t('common.allZones'));
  const [input, setInput] = useState<CampaignPreviewInput>({ placement: BannerPlacement.HOME_HERO, audience: 'CUSTOMER', language: 'ar', completedJobs: 0, isNewCustomer: true, usedJobTypes: [] });
  const preview = useMutation({ mutationFn: () => campaignsApi.preview(input), onError: (e) => toast.fromError(e) });

  return (
    <Card title={t('campaigns.tester')} description={t('campaigns.testerHint')}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div>
            <Label htmlFor="tester-placement">{t('campaigns.placement')}</Label>
            <NativeSelect id="tester-placement" value={input.placement} onChange={(e) => setInput((p) => ({ ...p, placement: e.target.value as BannerPlacement }))}>
              {Object.values(BannerPlacement).map((pl) => (
                <option key={pl} value={pl}>{enumLabel('bannerPlacement', pl)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tester-audience">{t('campaigns.audience')}</Label>
              <NativeSelect id="tester-audience" value={input.audience} onChange={(e) => setInput((p) => ({ ...p, audience: e.target.value as 'CUSTOMER' }))}>
                <option value="CUSTOMER">{enumLabel('bannerAudience', 'CUSTOMER')}</option>
                <option value="PARTNER">{enumLabel('bannerAudience', 'PARTNER')}</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="tester-language">{t('common.language')}</Label>
              <NativeSelect id="tester-language" value={input.language} onChange={(e) => setInput((p) => ({ ...p, language: e.target.value as 'ar' | 'en' }))}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tester-zone">{t('common.zone')}</Label>
              <NativeSelect id="tester-zone" value={input.zoneId ?? ''} onChange={(e) => setInput((p) => ({ ...p, zoneId: e.target.value || undefined }))}>
                {zones.options.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="tester-platform">{t('campaigns.platform')}</Label>
              <NativeSelect id="tester-platform" value={input.platform ?? ''} onChange={(e) => setInput((p) => ({ ...p, platform: (e.target.value || undefined) as 'ios' | undefined }))}>
                <option value="">{t('common.all')}</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
                <option value="web">Web</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tester-jobs">{t('campaigns.completedJobs')}</Label>
              <Input id="tester-jobs" type="number" min={0} dir="ltr" value={input.completedJobs ?? 0} onChange={(e) => setInput((p) => ({ ...p, completedJobs: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label htmlFor="tester-user">{t('campaigns.userId')}</Label>
              <Input id="tester-user" dir="ltr" placeholder="uuid" value={input.userId ?? ''} onChange={(e) => setInput((p) => ({ ...p, userId: e.target.value || undefined }))} />
            </div>
          </div>
          <Checkbox checked={!!input.isNewCustomer} onCheckedChange={(v) => setInput((p) => ({ ...p, isNewCustomer: v }))} label={t('campaigns.isNewCustomer')} />
          <div>
            <Label>{t('campaigns.serviceInterest')}</Label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-2">
              {[JobType.RIDE, JobType.DELIVERY, JobType.HOME_SERVICE].map((j) => (
                <Checkbox
                  key={j}
                  checked={(input.usedJobTypes ?? []).includes(j)}
                  onCheckedChange={(checked) => setInput((p) => ({ ...p, usedJobTypes: checked ? [...(p.usedJobTypes ?? []), j] : (p.usedJobTypes ?? []).filter((x) => x !== j) }))}
                  label={enumLabel('jobType', j)}
                />
              ))}
            </div>
          </div>
          <Button className="w-full" loading={preview.isPending} onClick={() => preview.mutate()}>
            {t('campaigns.runTest')}
          </Button>
        </div>
        <div>
          {!preview.data ? (
            <EmptyState title={t('campaigns.testerEmpty')} description={t('campaigns.testerEmptyHint')} />
          ) : preview.data.length === 0 ? (
            <EmptyState title={t('campaigns.testerNoMatch')} description={t('campaigns.testerNoMatchHint')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {preview.data.map((banner) => (
                <div key={banner.id} className={highlightCampaignId && banner.campaignId === highlightCampaignId ? 'rounded-lg ring-2 ring-accent' : undefined}>
                  <PhoneFrame>
                    <BannerPreview
                      language={input.language ?? 'ar'}
                      value={{ placement: banner.placement, theme: banner.creative.theme, headline: banner.creative.headline, subheadline: banner.creative.subheadline, ctaLabel: banner.creative.ctaLabel, badge: banner.creative.badge, imageUrl: input.language === 'en' ? banner.creative.imageUrl.en : banner.creative.imageUrl.ar }}
                    />
                  </PhoneFrame>
                  <p className="mt-2 flex flex-wrap justify-center gap-1 text-[11px]">
                    <Badge tone="brand">{t('campaigns.priority')}: {banner.priority}</Badge>
                    {highlightCampaignId && banner.campaignId === highlightCampaignId ? <Badge tone="accent">{t('campaigns.thisCampaign')}</Badge> : null}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
