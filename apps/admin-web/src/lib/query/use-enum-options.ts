'use client';

import { useMemo } from 'react';

import { type EnumGroup, useI18n } from '@/i18n';

/** Select options for an enum object (`{ KEY: 'KEY' }`) with translated labels. */
export function useEnumOptions(group: EnumGroup, values: readonly string[] | Record<string, string>, allLabel?: string) {
  const { enumLabel } = useI18n();
  return useMemo(() => {
    const list = Array.isArray(values) ? values : Object.values(values);
    const base = list.map((v) => ({ value: v, label: enumLabel(group, v) }));
    return allLabel !== undefined ? [{ value: '', label: allLabel }, ...base] : base;
  }, [group, values, allLabel, enumLabel]);
}
