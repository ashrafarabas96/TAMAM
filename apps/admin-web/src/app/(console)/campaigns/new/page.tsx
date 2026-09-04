'use client';

import { Permission } from '@tamam/shared-types';

import { CampaignForm } from '@/components/domain/campaigns/campaign-form';
import { RequirePermission } from '@/components/layout/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '@/i18n';

export default function NewCampaignPage() {
  return (
    <RequirePermission anyOf={[Permission.CAMPAIGNS_MANAGE]}>
      <NewCampaign />
    </RequirePermission>
  );
}

function NewCampaign() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        crumbs={[{ label: t('nav.campaigns'), href: '/campaigns' }, { label: t('campaigns.new') }]}
        title={t('campaigns.new')}
        description={t('campaigns.newHint')}
      />
      <CampaignForm campaign={null} />
    </div>
  );
}
