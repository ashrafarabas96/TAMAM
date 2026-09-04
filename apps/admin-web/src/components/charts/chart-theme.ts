'use client';

import { tokens } from '@tamam/ui-tokens';

import { useTheme } from '@/lib/theme';

/**
 * Chart colours come from design tokens only. The categorical order is fixed (never cycled) and
 * both variants were run through the dataviz palette validator (CVD separation, lightness band,
 * contrast vs. the surface) — do not reorder or substitute steps without re-validating.
 */
export interface ChartTheme {
  categorical: readonly [string, string, string, string];
  sequential: string;
  positive: string;
  negative: string;
  grid: string;
  axis: string;
  text: string;
  surface: string;
}

const light: ChartTheme = {
  categorical: [
    tokens.color.brand.purple[500],
    tokens.color.brand.yellow[800],
    tokens.color.semantic.info.base,
    tokens.color.semantic.danger.base,
  ],
  sequential: tokens.color.brand.purple[500],
  positive: tokens.color.semantic.success.base,
  negative: tokens.color.semantic.danger.base,
  grid: tokens.color.light.border,
  axis: tokens.color.light.textTertiary,
  text: tokens.color.light.textSecondary,
  surface: tokens.color.light.surface,
};

const dark: ChartTheme = {
  categorical: [
    tokens.color.brand.purple[400],
    tokens.color.brand.yellow[800],
    tokens.color.semantic.info.base,
    tokens.color.semantic.danger.base,
  ],
  sequential: tokens.color.brand.purple[400],
  positive: tokens.color.dark.mapPickup,
  negative: tokens.color.dark.mapDestination,
  grid: tokens.color.dark.border,
  axis: tokens.color.dark.textTertiary,
  text: tokens.color.dark.textSecondary,
  surface: tokens.color.dark.surface,
};

export function useChartTheme(): ChartTheme {
  const { resolved } = useTheme();
  return resolved === 'dark' ? dark : light;
}

/** Job-type colours are entity-bound: RIDE is always slot 0, DELIVERY slot 1, HOME_SERVICE slot 2. */
export const JOB_TYPE_SLOT: Record<string, number> = { RIDE: 0, DELIVERY: 1, HOME_SERVICE: 2 };
