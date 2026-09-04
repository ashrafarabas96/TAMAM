'use client';

import { useState } from 'react';

import { Permission, RestrictionTargetType, RiskSignal } from '@tamam/shared-types';

import { RestrictionsTable, RiskSignalsTable } from '@/components/domain/users/risk-panels';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterBar } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { useEnumOptions } from '@/lib/query/use-enum-options';

import { RestrictionDialog } from './restriction-dialog';

export default function RiskPage() {
  return (
    <RequirePermission anyOf={[Permission.RISK_READ]}>
      <RiskScreen />
    </RequirePermission>
  );
}

function RiskScreen() {
  const { t } = useI18n();
  const [signal, setSignal] = useState('');
  const [unreviewed, setUnreviewed] = useState(true);
  const [targetType, setTargetType] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [creating, setCreating] = useState(false);
  const signals = useEnumOptions('riskSignal', RiskSignal, t('common.all'));
  const targetTypes = useEnumOptions(
    'restrictionTargetType',
    RestrictionTargetType,
    t('common.all'),
  );

  return (
    <div>
      <PageHeader
        title={t('risk.title')}
        description={t('risk.subtitle')}
        actions={
          <Can anyOf={[Permission.RISK_MANAGE]}>
            <Button size="sm" onClick={() => setCreating(true)}>
              {t('risk.newRestriction')}
            </Button>
          </Can>
        }
      />
      <Tabs
        items={[
          {
            value: 'signals',
            label: t('risk.signals'),
            content: (
              <div>
                <FilterBar>
                  <Select
                    value={signal}
                    onValueChange={setSignal}
                    options={signals}
                    placeholder={t('risk.signal')}
                    aria-label={t('risk.signal')}
                  />
                  <Checkbox
                    checked={unreviewed}
                    onCheckedChange={setUnreviewed}
                    label={t('risk.onlyUnreviewed')}
                  />
                </FilterBar>
                <RiskSignalsTable
                  filters={{ signal: signal || undefined, unreviewed: unreviewed || undefined }}
                />
              </div>
            ),
          },
          {
            value: 'restrictions',
            label: t('risk.restrictions'),
            content: (
              <div>
                <FilterBar>
                  <Select
                    value={targetType}
                    onValueChange={setTargetType}
                    options={targetTypes}
                    placeholder={t('risk.target')}
                    aria-label={t('risk.target')}
                  />
                  <Checkbox
                    checked={activeOnly}
                    onCheckedChange={setActiveOnly}
                    label={t('risk.onlyActive')}
                  />
                </FilterBar>
                <RestrictionsTable
                  filters={{
                    targetType: targetType || undefined,
                    activeOnly: activeOnly || undefined,
                  }}
                />
              </div>
            ),
          },
        ]}
      />
      <RestrictionDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
