'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useI18n } from '@/i18n';
import { catalogApi } from '@/lib/api/endpoints/catalog';
import { zonesApi } from '@/lib/api/endpoints/zones';
import { queryKeys } from '@/lib/query-keys';

const FIVE_MINUTES = 5 * 60_000;

/** Zones, categories and vehicle types are referenced by id everywhere — cached for filters/selects. */
export function useZones(enabled = true) {
  return useQuery({
    queryKey: queryKeys.zones.list,
    queryFn: zonesApi.list,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

export function useZoneOptions(enabled = true, includeAll?: string) {
  const { localized } = useI18n();
  const query = useZones(enabled);
  const options = useMemo(() => {
    const base = (query.data ?? []).map((z) => ({ value: z.id, label: localized(z.name) }));
    return includeAll !== undefined ? [{ value: '', label: includeAll }, ...base] : base;
  }, [query.data, localized, includeAll]);
  const nameOf = useMemo(() => {
    const map = new Map((query.data ?? []).map((z) => [z.id, localized(z.name)] as const));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id) : '—');
  }, [query.data, localized]);
  return { options, zones: query.data ?? [], nameOf, isLoading: query.isPending };
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.categories,
    queryFn: catalogApi.adminCategories,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

export function useCategoryOptions(enabled = true) {
  const { localized } = useI18n();
  const query = useCategories(enabled);
  const options = useMemo(
    () => (query.data ?? []).map((c) => ({ value: c.id, label: localized(c.name) })),
    [query.data, localized],
  );
  const nameOf = useMemo(() => {
    const map = new Map((query.data ?? []).map((c) => [c.id, localized(c.name)] as const));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id) : '—');
  }, [query.data, localized]);
  return { options, categories: query.data ?? [], nameOf, isLoading: query.isPending };
}

export function useVehicleTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.vehicleTypes,
    queryFn: catalogApi.adminVehicleTypes,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

export function useVehicleTypeOptions(enabled = true) {
  const { localized } = useI18n();
  const query = useVehicleTypes(enabled);
  const options = useMemo(
    () =>
      (query.data ?? []).map((v) => ({ value: v.id, label: `${localized(v.name)} (${v.code})` })),
    [query.data, localized],
  );
  const nameOf = useMemo(() => {
    const map = new Map((query.data ?? []).map((v) => [v.id, localized(v.name)] as const));
    return (id: string | null | undefined) => (id ? (map.get(id) ?? id) : '—');
  }, [query.data, localized]);
  return { options, vehicleTypes: query.data ?? [], nameOf, isLoading: query.isPending };
}

export function useServiceTypes() {
  return useQuery({
    queryKey: queryKeys.catalog.serviceTypes,
    queryFn: catalogApi.serviceTypes,
    staleTime: FIVE_MINUTES,
  });
}
