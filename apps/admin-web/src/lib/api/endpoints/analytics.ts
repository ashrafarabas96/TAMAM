import type { OpsDashboardDto } from '@tamam/shared-types';
import type { ReportQueryInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { DailyKpiDto, ReportResult } from '@/lib/api/types';

export const analyticsApi = {
  dashboard: () => api.get<OpsDashboardDto>('/admin/dashboard'),
  kpis: (query: { from: string; to: string; zoneId?: string }) => api.get<DailyKpiDto[]>('/admin/kpis', query),
  report: (query: Omit<ReportQueryInput, 'format'>) => api.get<ReportResult>('/admin/reports', { ...query, format: 'json' }),
  /** `csv` / `xlsx` are streamed as attachments and additionally require REPORTS_EXPORT. */
  exportReport: (query: Omit<ReportQueryInput, 'format'>, format: 'csv' | 'xlsx') => api.raw('/admin/reports', { method: 'GET', query: { ...query, format } }),
};
