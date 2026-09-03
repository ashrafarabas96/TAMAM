'use client';

import { useState } from 'react';

import { Permission, type ServiceCategoryDto } from '@tamam/shared-types';

import { CategoriesPanel, PackageCategoriesPanel, VehicleTypesPanel } from '@/components/domain/catalog/catalog-tabs';
import { CategoryDialog } from '@/components/domain/catalog/category-dialog';
import { RequirePermission } from '@/components/layout/require-permission';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';

export default function ServicesPage() {
  return (
    <RequirePermission anyOf={[Permission.SERVICES_READ]}>
      <ServicesScreen />
    </RequirePermission>
  );
}

function ServicesScreen() {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ServiceCategoryDto | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <PageHeader title={t('services.title')} description={t('services.subtitle')} />
      <Tabs
        items={[
          { value: 'categories', label: t('services.categories'), content: <CategoriesPanel onEdit={setEditing} onCreate={() => setCreating(true)} /> },
          { value: 'vehicle-types', label: t('services.vehicleTypes'), content: <VehicleTypesPanel /> },
          { value: 'package-categories', label: t('services.packageCategories'), content: <PackageCategoriesPanel /> },
        ]}
      />
      <CategoryDialog category={editing} open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} />
    </div>
  );
}
