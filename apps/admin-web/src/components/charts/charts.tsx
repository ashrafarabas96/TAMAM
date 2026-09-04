'use client';

import { type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils/cn';

import { useChartTheme } from './chart-theme';

export interface Series {
  key: string;
  label: string;
  /** Categorical slot (0..3). Fixed per entity, never cycled. */
  slot?: number;
  /** Optional explicit colour (for status-coded series). */
  color?: string;
}

interface BaseChartProps {
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  series: Series[];
  height?: number;
  valueFormatter?: (value: number, key: string) => string;
  xFormatter?: (value: string) => string;
  className?: string;
  /** Screen-reader table under the chart. */
  tableCaption?: string;
}

function ChartFrame({
  children,
  className,
  table,
}: {
  children: ReactNode;
  className?: string;
  table?: ReactNode;
}) {
  return (
    <div className={cn('w-full', className)} dir="ltr">
      {children}
      {table}
    </div>
  );
}

function DataTableSr({
  data,
  xKey,
  series,
  caption,
}: Pick<BaseChartProps, 'data' | 'xKey' | 'series'> & { caption?: string }) {
  if (!caption) return null;
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>{xKey}</th>
          {series.map((s) => (
            <th key={s.key}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td>{String(row[xKey] ?? '')}</td>
            {series.map((s) => (
              <td key={s.key}>{String(row[s.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useCommon(props: BaseChartProps) {
  const theme = useChartTheme();
  const { locale } = useI18n();
  const colorFor = (s: Series, i: number) =>
    s.color ?? theme.categorical[(s.slot ?? i) % theme.categorical.length] ?? theme.sequential;
  const tooltipStyle = {
    backgroundColor: theme.surface,
    border: `1px solid ${theme.grid}`,
    borderRadius: 10,
    color: theme.text,
    fontSize: 12,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
  } as const;
  const formatValue = (value: unknown, name: unknown): [string, string] => {
    const key = String(name);
    const label = props.series.find((s) => s.key === key)?.label ?? key;
    const num = typeof value === 'number' ? value : Number(value);
    return [props.valueFormatter ? props.valueFormatter(num, key) : String(value), label];
  };
  return { theme, colorFor, tooltipStyle, formatValue };
}

export function TimeSeriesChart({
  kind = 'line',
  ...props
}: BaseChartProps & { kind?: 'line' | 'area' }) {
  const { data, xKey, series, height = 260, xFormatter, className, tableCaption } = props;
  const { theme, colorFor, tooltipStyle, formatValue } = useCommon(props);
  const Chart = kind === 'area' ? AreaChart : LineChart;
  return (
    <ChartFrame
      className={className}
      table={<DataTableSr data={data} xKey={xKey} series={series} caption={tableCaption} />}
    >
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tickFormatter={xFormatter}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) =>
              props.valueFormatter ? props.valueFormatter(v, series[0]?.key ?? '') : String(v)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatValue}
            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
          />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: theme.text }} /> : null}
          {series.map((s, i) =>
            kind === 'area' ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={colorFor(s, i)}
                fill={colorFor(s, i)}
                fillOpacity={0.12}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={colorFor(s, i)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
                isAnimationActive={false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BarsChart({ stacked = false, ...props }: BaseChartProps & { stacked?: boolean }) {
  const { data, xKey, series, height = 260, xFormatter, className, tableCaption } = props;
  const { theme, colorFor, tooltipStyle, formatValue } = useCommon(props);
  return (
    <ChartFrame
      className={className}
      table={<DataTableSr data={data} xKey={xKey} series={series} caption={tableCaption} />}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          barGap={2}
        >
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tickFormatter={xFormatter}
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) =>
              props.valueFormatter ? props.valueFormatter(v, series[0]?.key ?? '') : String(v)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatValue}
            cursor={{ fill: theme.grid, opacity: 0.5 }}
          />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: theme.text }} /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              fill={colorFor(s, i)}
              stackId={stacked ? 'stack' : undefined}
              radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
              stroke={theme.surface}
              strokeWidth={stacked ? 2 : 0}
              isAnimationActive={false}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
