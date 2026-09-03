'use client';

import { Suspense } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Permission } from '@tamam/shared-types';

import { JobsList } from '@/components/domain/jobs/jobs-list';
import { SosPanel } from '@/components/domain/jobs/sos-panel';
import { RequirePermission } from '@/components/layout/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';

export default function JobsPage() {
  return (
    <RequirePermission anyOf={[Permission.JOBS_READ_ALL]}>
      <Suspense fallback={null}>
        <JobsScreen />
      </Suspense>
    </RequirePermission>
  );
}

function JobsScreen() {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'sos' ? 'sos' : 'list';
  return (
    <div>
      <PageHeader title={t('jobs.title')} description={t('jobs.subtitle')} />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(v === 'sos' ? '/jobs?tab=sos' : '/jobs')}
        items={[
          { value: 'list', label: t('jobs.allJobs'), content: <JobsList /> },
          { value: 'sos', label: t('sos.title'), content: <SosPanel /> },
        ]}
      />
    </div>
  );
}

