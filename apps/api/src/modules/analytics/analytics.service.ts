import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVE_JOB_STATUSES, CONFIG_KEYS, JobStatus, type Money, type OpsDashboardDto, Permission, V1_JOB_TYPES } from '@tamam/shared-types';
import type { ReportQueryInput } from '@tamam/validation';
import { Workbook } from 'exceljs';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { toMoney } from '../../common/utils/money';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SystemConfigService } from '../config/system-config.service';

/* -------------------------------------------------------------- contracts */

/** Product analytics events the API accepts (spec §117). Anything else is dropped. */
export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'service_selected',
  'job_created',
  'partner_assigned',
  'job_started',
  'job_completed',
  'job_cancelled',
  'quote_approved',
  'payment_success',
  'banner_impression',
  'banner_click',
  'search_performed',
  'screen_view',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export interface TrackEventInput {
  name: string;
  occurredAt: string;
  props?: Record<string, unknown>;
  jobId?: string;
  zoneId?: string;
  sessionId?: string;
}

export interface TrackResult {
  accepted: number;
  rejected: number;
}

export interface DailyKpiDto {
  date: string;
  zoneId: string | null;
  jobsCreated: number;
  jobsCompleted: number;
  jobsCancelled: number;
  gmv: Money;
  platformRevenue: Money;
  avgDispatchSeconds: number | null;
  avgPickupEtaSeconds: number | null;
  activeCustomers: number;
  repeatCustomers: number;
  activePartners: number;
  partnerUtilization: number | null;
  computedAt: string;
}

export interface ReportRow {
  key: string;
  jobs: number;
  completed: number;
  cancelled: number;
  gmv: Money;
  revenue: Money;
  avgFare: Money;
}

export interface ReportResult {
  groupBy: ReportQueryInput['groupBy'];
  from: string;
  to: string;
  currency: string;
  rows: ReportRow[];
}

export interface ExportedReport {
  filename: string;
  contentType: string;
  body: string | Buffer;
}

/* ---------------------------------------------------------------- helpers */

const ALLOWED_EVENTS = new Set<string>(ANALYTICS_EVENT_NAMES);
export const isTrackedEvent = (name: string): name is AnalyticsEventName => ALLOWED_EVENTS.has(name);

/** Property keys that may carry personal data — never persisted with the event (spec §90, §117). */
const PII_KEY = /(phone|e?mail|name|token)/i;
const MAX_PROPS_DEPTH = 4;
const MAX_PROPS_KEYS = 40;

/** Recursively removes PII-looking keys from a props object. Values themselves are untouched. */
export function stripPii(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return depth >= MAX_PROPS_DEPTH ? [] : value.slice(0, 50).map((v) => stripPii(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth >= MAX_PROPS_DEPTH) return {};
    const out: Record<string, unknown> = {};
    let kept = 0;
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEY.test(key)) continue;
      if (kept >= MAX_PROPS_KEYS) break;
      out[key] = stripPii(inner, depth + 1);
      kept += 1;
    }
    return out;
  }
  return value;
}

/** Start of the calendar day containing `at`, in `timeZone`, expressed as a UTC instant. */
export function zonedDayStart(at: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const wallClock = Date.UTC(year, month - 1, day, get('hour') % 24, get('minute'), get('second'));
  const offsetMs = wallClock - Math.floor(at.getTime() / 1000) * 1000;
  return new Date(Date.UTC(year, month - 1, day) - offsetMs);
}

/** `[start, end)` of the calendar day containing `at` in `timeZone` — DST-safe (never assumes 24h). */
export function zonedDayRange(at: Date, timeZone: string): { start: Date; end: Date } {
  const start = zonedDayStart(at, timeZone);
  const end = zonedDayStart(new Date(start.getTime() + 26 * 3_600_000), timeZone);
  return { start, end };
}

/** `YYYY-MM-DD` of the calendar day containing `at` in `timeZone`. */
export function zonedDateKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const OPS_CACHE_KEY = 'analytics:ops-dashboard';
const OPS_CACHE_TTL_S = 15;

interface AvgRow {
  avg_seconds: number | null;
}
interface CountRow {
  count: number;
}
interface SumRow {
  total: bigint | null;
}
interface ReportSqlRow {
  bucket: string | null;
  jobs: number;
  completed: number;
  cancelled: number;
  gmv_minor: bigint;
  revenue_minor: bigint;
}

/**
 * Product analytics, the live operations dashboard, nightly KPIs and admin reporting
 * (spec §116–§118).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly systemConfig: SystemConfigService,
    private readonly config: AppConfigService,
  ) {}

  private get timezone(): string {
    return this.config.env.DEFAULT_TIMEZONE;
  }

  private get currency(): string {
    return this.config.env.DEFAULT_CURRENCY;
  }

  /* ---------------------------------------------------------- ingestion */

  /**
   * Bulk-ingests client events. Unknown event names are dropped (the whitelist is the contract,
   * not the client) and PII-looking props keys are stripped before the row is written.
   */
  async track(user: RequestUser | null, events: TrackEventInput[], platform: string | null, appVersion: string | null): Promise<TrackResult> {
    const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
    for (const event of events) {
      if (!isTrackedEvent(event.name)) continue;
      const props = event.props ? (stripPii(event.props) as Prisma.InputJsonValue) : undefined;
      rows.push({
        name: event.name,
        userId: user?.id ?? null,
        sessionId: event.sessionId ?? user?.sessionId ?? null,
        platform: platform ? platform.slice(0, 10) : null,
        appVersion: appVersion ? appVersion.slice(0, 40) : null,
        jobId: event.jobId ?? null,
        zoneId: event.zoneId ?? null,
        ...(props === undefined ? {} : { props }),
        occurredAt: new Date(event.occurredAt),
      });
    }
    if (!rows.length) return { accepted: 0, rejected: events.length };
    const created = await this.prisma.analyticsEvent.createMany({ data: rows });
    return { accepted: created.count, rejected: events.length - created.count };
  }

  /* ---------------------------------------------------------- dashboard */

  /** Live operations snapshot, cached for 15 s so a room full of dispatchers costs one query set. */
  async opsDashboard(): Promise<OpsDashboardDto> {
    const cached = await this.redis.getJson<OpsDashboardDto>(OPS_CACHE_KEY);
    if (cached) return cached;

    const now = new Date();
    const { start, end } = zonedDayRange(now, this.timezone);
    const offlineAfter = await this.systemConfig.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S);
    const heartbeatCutoff = new Date(now.getTime() - offlineAfter * 1000);

    const [
      activeJobs,
      searchingJobs,
      completedToday,
      cancelledToday,
      onlinePartners,
      availablePartners,
      grossBookings,
      platformRevenueMinor,
      openSupportTickets,
      dispatchAvg,
      pickupEtaAvg,
      activeByType,
      completedByType,
    ] = await Promise.all([
      this.prisma.job.count({ where: { status: { in: [...ACTIVE_JOB_STATUSES] } } }),
      this.prisma.job.count({ where: { status: JobStatus.SEARCHING } }),
      this.prisma.job.count({ where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
      this.prisma.job.count({ where: { status: JobStatus.CANCELLED, cancelledAt: { gte: start, lt: end } } }),
      this.prisma.partnerAvailability.count({ where: { status: 'ONLINE', lastHeartbeatAt: { gte: heartbeatCutoff } } }),
      this.prisma.partnerAvailability.count({ where: { status: 'ONLINE', lastHeartbeatAt: { gte: heartbeatCutoff }, currentJobId: null } }),
      this.prisma.job.aggregate({ _sum: { finalTotalMinor: true }, where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
      this.platformRevenueBetween(start, end),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } } }),
      this.avgDispatchSeconds(start, end),
      this.prisma.job.aggregate({ _avg: { etaToPickupSeconds: true }, where: { assignedAt: { gte: start, lt: end } } }),
      this.prisma.job.groupBy({ by: ['type'], where: { status: { in: [...ACTIVE_JOB_STATUSES] } }, _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['type'], where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } }, _count: { _all: true } }),
    ]);

    const activeMap = new Map<string, number>(activeByType.map((r) => [r.type, r._count._all]));
    const completedMap = new Map<string, number>(completedByType.map((r) => [r.type, r._count._all]));

    const dto: OpsDashboardDto = {
      activeJobs,
      searchingJobs,
      completedToday,
      cancelledToday,
      onlinePartners,
      availablePartners,
      grossBookingsToday: toMoney(grossBookings._sum.finalTotalMinor ?? 0n, this.currency),
      platformRevenueToday: toMoney(platformRevenueMinor, this.currency),
      openSupportTickets,
      averageDispatchSeconds: dispatchAvg,
      averagePickupEtaSeconds: pickupEtaAvg._avg.etaToPickupSeconds === null ? null : Math.round(pickupEtaAvg._avg.etaToPickupSeconds),
      byJobType: V1_JOB_TYPES.map((type) => ({ type, active: activeMap.get(type) ?? 0, completedToday: completedMap.get(type) ?? 0 })),
      generatedAt: now.toISOString(),
    };

    await this.redis.setJson(OPS_CACHE_KEY, dto, OPS_CACHE_TTL_S);
    return dto;
  }

  /* --------------------------------------------------------------- KPIs */

  /**
   * Materialises one calendar day of platform KPIs (spec §118). Idempotent — the maintenance
   * queue may re-run a day at any time.
   *
   * `partnerUtilization` is an approximation: `completedJobs × averageJobDurationSeconds /
   * (activePartners × 86400)`, clamped to [0, 1]. We do not retain a historical online-seconds
   * series, so "active partners" (partners who worked at least one job that day) stands in for
   * "online partners"; the number is a trend indicator, not a billing figure.
   */
  async computeDailyKpis(date: Date): Promise<DailyKpiDto> {
    const { start, end } = zonedDayRange(date, this.timezone);
    // `daily_kpis.date` is a DATE column: key it by the *local* calendar day, not by the UTC
    // parts of `start` (which land on the previous day for any timezone ahead of UTC).
    const dayKey = new Date(`${zonedDateKey(date, this.timezone)}T00:00:00.000Z`);

    const [jobsCreated, jobsCompleted, jobsCancelled, gmv, platformRevenueMinor, dispatchAvg, pickupEtaAvg, durationAvg, activeCustomers, repeatCustomers, activePartners] =
      await Promise.all([
        this.prisma.job.count({ where: { createdAt: { gte: start, lt: end } } }),
        this.prisma.job.count({ where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
        this.prisma.job.count({ where: { status: JobStatus.CANCELLED, cancelledAt: { gte: start, lt: end } } }),
        this.prisma.job.aggregate({ _sum: { finalTotalMinor: true }, where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
        this.platformRevenueBetween(start, end),
        this.avgDispatchSeconds(start, end),
        this.prisma.job.aggregate({ _avg: { etaToPickupSeconds: true }, where: { assignedAt: { gte: start, lt: end } } }),
        this.prisma.job.aggregate({ _avg: { actualDurationSeconds: true, durationSeconds: true }, where: { status: JobStatus.COMPLETED, completedAt: { gte: start, lt: end } } }),
        this.distinctCount(Prisma.sql`SELECT COUNT(DISTINCT customer_id)::int AS count FROM jobs WHERE created_at >= ${start} AND created_at < ${end}`),
        this.distinctCount(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM (
            SELECT j.customer_id FROM jobs j WHERE j.created_at >= ${start} AND j.created_at < ${end} GROUP BY 1
          ) d
          JOIN customer_profiles cp ON cp.user_id = d.customer_id
          WHERE cp.completed_jobs >= 2`),
        this.distinctCount(Prisma.sql`SELECT COUNT(DISTINCT partner_id)::int AS count FROM jobs WHERE partner_id IS NOT NULL AND created_at >= ${start} AND created_at < ${end}`),
      ]);

    const avgDuration = durationAvg._avg.actualDurationSeconds ?? durationAvg._avg.durationSeconds ?? 0;
    const utilization = activePartners > 0 ? Math.min(1, Math.max(0, (jobsCompleted * avgDuration) / (activePartners * 86_400))) : null;

    const row = await this.prisma.dailyKpi.upsert({
      where: { date: dayKey },
      create: {
        date: dayKey,
        zoneId: null,
        jobsCreated,
        jobsCompleted,
        jobsCancelled,
        gmvMinor: gmv._sum.finalTotalMinor ?? 0n,
        platformRevenueMinor,
        avgDispatchSeconds: dispatchAvg,
        avgPickupEtaSeconds: pickupEtaAvg._avg.etaToPickupSeconds === null ? null : Math.round(pickupEtaAvg._avg.etaToPickupSeconds),
        activeCustomers,
        repeatCustomers,
        activePartners,
        partnerUtilization: utilization === null ? null : new Prisma.Decimal(utilization.toFixed(4)),
        currency: this.currency,
      },
      update: {
        jobsCreated,
        jobsCompleted,
        jobsCancelled,
        gmvMinor: gmv._sum.finalTotalMinor ?? 0n,
        platformRevenueMinor,
        avgDispatchSeconds: dispatchAvg,
        avgPickupEtaSeconds: pickupEtaAvg._avg.etaToPickupSeconds === null ? null : Math.round(pickupEtaAvg._avg.etaToPickupSeconds),
        activeCustomers,
        repeatCustomers,
        activePartners,
        partnerUtilization: utilization === null ? null : new Prisma.Decimal(utilization.toFixed(4)),
        currency: this.currency,
        computedAt: new Date(),
      },
    });

    return this.toKpiDto(row);
  }

  async kpis(from: string, to: string, zoneId?: string): Promise<DailyKpiDto[]> {
    const rows = await this.prisma.dailyKpi.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) }, ...(zoneId ? { zoneId } : {}) },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toKpiDto(r));
  }

  /* ------------------------------------------------------------ reports */

  /** Grouped operational report. `revenue` is the net platform revenue posted against each job. */
  async report(query: ReportQueryInput): Promise<ReportResult> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const bucket = this.bucketExpression(query.groupBy);

    const conditions: Prisma.Sql[] = [Prisma.sql`j.created_at >= ${from}`, Prisma.sql`j.created_at < ${to}`];
    if (query.zoneId) conditions.push(Prisma.sql`j.zone_id = ${query.zoneId}::uuid`);
    if (query.jobType) conditions.push(Prisma.sql`j.type = ${query.jobType}::job_type`);
    if (query.partnerId) conditions.push(Prisma.sql`j.partner_id = ${query.partnerId}::uuid`);
    if (query.paymentMethod) conditions.push(Prisma.sql`j.payment_method = ${query.paymentMethod}::payment_method`);

    const rows = await this.prisma.$queryRaw<ReportSqlRow[]>`
      SELECT ${bucket} AS bucket,
             COUNT(*)::int AS jobs,
             COUNT(*) FILTER (WHERE j.status = 'COMPLETED')::int AS completed,
             COUNT(*) FILTER (WHERE j.status = 'CANCELLED')::int AS cancelled,
             COALESCE(SUM(CASE WHEN j.status = 'COMPLETED' THEN j.final_total_minor ELSE 0 END), 0)::bigint AS gmv_minor,
             COALESCE(SUM(rev.revenue_minor), 0)::bigint AS revenue_minor
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_minor ELSE -e.amount_minor END), 0) AS revenue_minor
        FROM ledger_entries e
        JOIN ledger_transactions t ON t.id = e.transaction_id
        JOIN ledger_accounts a ON a.id = e.account_id
        WHERE t.job_id = j.id AND a.type = 'PLATFORM_REVENUE'
      ) rev ON TRUE
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY 1
      ORDER BY 1`;

    return {
      groupBy: query.groupBy,
      from: from.toISOString(),
      to: to.toISOString(),
      currency: this.currency,
      rows: rows.map((r) => {
        const gmv = BigInt(r.gmv_minor);
        const completed = Number(r.completed);
        return {
          key: r.bucket ?? 'unknown',
          jobs: Number(r.jobs),
          completed,
          cancelled: Number(r.cancelled),
          gmv: toMoney(gmv, this.currency),
          revenue: toMoney(BigInt(r.revenue_minor), this.currency),
          avgFare: toMoney(completed > 0 ? gmv / BigInt(completed) : 0n, this.currency),
        };
      }),
    };
  }

  /** CSV / XLSX rendering of {@link report}. Requires the reports.export permission. */
  async exportReport(query: ReportQueryInput, actor: RequestUser): Promise<ExportedReport> {
    if (!actor.isSuperAdmin && !actor.permissions.includes(Permission.REPORTS_EXPORT)) {
      throw AppException.forbidden('Exporting reports requires the reports.export permission');
    }
    const result = await this.report(query);
    const stamp = result.from.slice(0, 10);
    const header = ['key', 'jobs', 'completed', 'cancelled', `gmv_${result.currency}`, `revenue_${result.currency}`, `avg_fare_${result.currency}`];
    const body = result.rows.map((r) => [r.key, r.jobs, r.completed, r.cancelled, r.gmv.amount, r.revenue.amount, r.avgFare.amount]);

    if (query.format === 'csv') {
      const lines = [header.join(','), ...body.map((cells) => cells.map(csvCell).join(','))];
      // Leading BOM so Excel opens Arabic zone / partner labels in UTF-8.
      return { filename: `tamam-report-${query.groupBy}-${stamp}.csv`, contentType: 'text/csv; charset=utf-8', body: `\uFEFF${lines.join('\r\n')}\r\n` };
    }

    const workbook = new Workbook();
    workbook.creator = 'TAMAM';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(`report-${query.groupBy}`);
    sheet.columns = header.map((name) => ({ header: name, key: name, width: 18 }));
    for (const cells of body) sheet.addRow(cells);
    sheet.getRow(1).font = { bold: true };
    const raw: unknown = await workbook.xlsx.writeBuffer();
    return {
      filename: `tamam-report-${query.groupBy}-${stamp}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Buffer.from(raw as ArrayBuffer),
    };
  }

  /* ------------------------------------------------------------ internals */

  private bucketExpression(groupBy: ReportQueryInput['groupBy']): Prisma.Sql {
    const tz = this.timezone;
    switch (groupBy) {
      case 'day':
        return Prisma.sql`to_char(j.created_at AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
      case 'week':
        return Prisma.sql`to_char(date_trunc('week', j.created_at AT TIME ZONE ${tz}), 'IYYY-"W"IW')`;
      case 'month':
        return Prisma.sql`to_char(j.created_at AT TIME ZONE ${tz}, 'YYYY-MM')`;
      case 'zone':
        return Prisma.sql`j.zone_id::text`;
      case 'jobType':
        return Prisma.sql`j.type::text`;
      case 'partner':
        return Prisma.sql`COALESCE(j.partner_id::text, 'unassigned')`;
      case 'paymentMethod':
        return Prisma.sql`j.payment_method::text`;
    }
  }

  /** Net platform revenue (credits − debits on PLATFORM_REVENUE accounts) posted in the window. */
  private async platformRevenueBetween(start: Date, end: Date): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<SumRow[]>`
      SELECT COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount_minor ELSE -e.amount_minor END), 0)::bigint AS total
      FROM ledger_entries e
      JOIN ledger_accounts a ON a.id = e.account_id
      WHERE a.type = 'PLATFORM_REVENUE' AND e.created_at >= ${start} AND e.created_at < ${end}`;
    return BigInt(rows[0]?.total ?? 0);
  }

  private async avgDispatchSeconds(start: Date, end: Date): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<AvgRow[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (assigned_at - created_at)))::float8 AS avg_seconds
      FROM jobs
      WHERE assigned_at IS NOT NULL AND assigned_at >= ${start} AND assigned_at < ${end}`;
    const value = rows[0]?.avg_seconds;
    return value === null || value === undefined ? null : Math.round(value);
  }

  private async distinctCount(sql: Prisma.Sql): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(sql);
    return Number(rows[0]?.count ?? 0);
  }

  private toKpiDto(row: {
    date: Date;
    zoneId: string | null;
    jobsCreated: number;
    jobsCompleted: number;
    jobsCancelled: number;
    gmvMinor: bigint;
    platformRevenueMinor: bigint;
    avgDispatchSeconds: number | null;
    avgPickupEtaSeconds: number | null;
    activeCustomers: number;
    repeatCustomers: number;
    activePartners: number;
    partnerUtilization: Prisma.Decimal | null;
    currency: string;
    computedAt: Date;
  }): DailyKpiDto {
    return {
      date: row.date.toISOString().slice(0, 10),
      zoneId: row.zoneId,
      jobsCreated: row.jobsCreated,
      jobsCompleted: row.jobsCompleted,
      jobsCancelled: row.jobsCancelled,
      gmv: toMoney(row.gmvMinor, row.currency),
      platformRevenue: toMoney(row.platformRevenueMinor, row.currency),
      avgDispatchSeconds: row.avgDispatchSeconds,
      avgPickupEtaSeconds: row.avgPickupEtaSeconds,
      activeCustomers: row.activeCustomers,
      repeatCustomers: row.repeatCustomers,
      activePartners: row.activePartners,
      partnerUtilization: row.partnerUtilization === null ? null : Number(row.partnerUtilization),
      computedAt: row.computedAt.toISOString(),
    };
  }
}

/** RFC-4180 escaping — a report key may legitimately contain a comma or a quote. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
