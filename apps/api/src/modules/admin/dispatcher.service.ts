import { Injectable } from '@nestjs/common';
import { AssignmentStatus, CONFIG_KEYS, type JobDto, JobStatus, type JobType, type Page } from '@tamam/shared-types';
import type { DispatcherJobsFilterInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { startOfUtcDay } from '../../common/utils/time';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { JobMapper } from '../jobs/job.mapper';
import { jobInclude } from '../jobs/jobs.types';

import { DEFAULT_PROBLEM_THRESHOLDS, type DispatchProblem, classifyProblems, isUnassignedStatus } from './domain/dispatch-problems';

/** Statuses the console watches: everything that is either unassigned or possibly stuck. */
const CONSOLE_STATUSES: readonly JobStatus[] = [
  JobStatus.REQUESTED,
  JobStatus.SEARCHING,
  JobStatus.NO_PARTNER_AVAILABLE,
  JobStatus.ASSIGNED,
  JobStatus.PARTNER_EN_ROUTE,
  JobStatus.WAITING_CUSTOMER,
];

export interface DispatchConsoleRow {
  job: JobDto;
  problems: DispatchProblem[];
  /** Highest wave that has been offered so far (0 = dispatch has not started). */
  wave: number;
  offersSent: number;
  offersRejected: number;
  offersExpired: number;
  offersPending: number;
  /** Seconds since the job entered dispatch, or since it was assigned when a partner is on it. */
  waitingSeconds: number;
  partner: {
    id: string;
    fullName: string | null;
    phone: string;
    availability: string;
    lastHeartbeatAt: string | null;
    heartbeatAgeSeconds: number | null;
    location: { lat: number; lng: number } | null;
  } | null;
}

export interface PartnerTimelineEntry {
  kind: 'JOB_EVENT' | 'ASSIGNMENT';
  at: string;
  jobId: string;
  jobNumber: string;
  jobType: JobType;
  type: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  data: Record<string, unknown> | null;
}

export interface PartnerTimelineDto {
  partnerId: string;
  fullName: string | null;
  phone: string;
  availability: string;
  lastHeartbeatAt: string | null;
  currentJobId: string | null;
  from: string;
  to: string;
  entries: PartnerTimelineEntry[];
}

/**
 * The dispatcher console (spec §140): every job that needs a human right now, with the dispatch
 * telemetry (wave, offers, partner heartbeat) required to decide between waiting, re-dispatching
 * and manual assignment. Read-only — the actions themselves live in `DispatchController`.
 */
@Injectable()
export class DispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: SystemConfigService,
    private readonly dispatch: DispatchService,
    private readonly mapper: JobMapper,
  ) {}

  async console(filter: DispatcherJobsFilterInput, user: RequestUser): Promise<Page<DispatchConsoleRow>> {
    const cursor = decodeCursor(filter.cursor);
    const heartbeatStaleSeconds = await this.config.getNumber(CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S);
    const thresholds = { ...DEFAULT_PROBLEM_THRESHOLDS, heartbeatStaleSeconds };
    const now = new Date();

    const statuses = filter.onlyUnassigned
      ? [JobStatus.REQUESTED, JobStatus.SEARCHING, JobStatus.NO_PARTNER_AVAILABLE]
      : filter.onlyProblem
        ? [JobStatus.ASSIGNED, JobStatus.PARTNER_EN_ROUTE, JobStatus.WAITING_CUSTOMER, JobStatus.NO_PARTNER_AVAILABLE]
        : [...CONSOLE_STATUSES];

    const rows = await this.prisma.job.findMany({
      where: { ...cursorWhere(cursor), status: { in: statuses }, zoneId: filter.zoneId, type: filter.jobType },
      include: jobInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    if (!rows.length) return { items: [], nextCursor: null };

    const jobIds = rows.map((r) => r.id);
    const [assignments, enRouteEvents] = await Promise.all([
      this.prisma.jobAssignment.findMany({ where: { jobId: { in: jobIds } }, select: { jobId: true, partnerId: true, wave: true, status: true, etaSeconds: true, offeredAt: true } }),
      this.prisma.jobEvent.findMany({ where: { jobId: { in: jobIds }, toStatus: JobStatus.PARTNER_EN_ROUTE }, select: { jobId: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const enRouteAt = new Map<string, Date>();
    for (const e of enRouteEvents) if (!enRouteAt.has(e.jobId)) enRouteAt.set(e.jobId, e.createdAt);

    const page = buildPage(rows, filter.limit, (job) => {
      const jobAssignments = assignments.filter((a) => a.jobId === job.id);
      const accepted = jobAssignments.find((a) => a.status === AssignmentStatus.ACCEPTED);
      const availability = job.partner?.availability ?? null;
      const heartbeat = availability?.lastHeartbeatAt ?? null;
      const problems = classifyProblems(
        {
          status: job.status,
          partnerId: job.partnerId,
          assignedAt: job.assignedAt,
          enRouteAt: enRouteAt.get(job.id) ?? null,
          etaToPickupSeconds: accepted?.etaSeconds ?? job.etaToPickupSeconds,
          partnerLastHeartbeatAt: heartbeat,
        },
        thresholds,
        now,
      );
      const since = job.assignedAt ?? job.dispatchStartedAt ?? job.createdAt;
      return {
        job: this.mapper.toDto(job, user),
        problems,
        wave: jobAssignments.reduce((max, a) => Math.max(max, a.wave), job.dispatchWave),
        offersSent: jobAssignments.length,
        offersRejected: jobAssignments.filter((a) => a.status === AssignmentStatus.REJECTED).length,
        offersExpired: jobAssignments.filter((a) => a.status === AssignmentStatus.EXPIRED).length,
        offersPending: jobAssignments.filter((a) => a.status === AssignmentStatus.OFFERED).length,
        waitingSeconds: Math.max(0, Math.round((now.getTime() - since.getTime()) / 1000)),
        partner: job.partner
          ? {
              id: job.partner.userId,
              fullName: job.partner.user.fullName,
              phone: job.partner.user.phone,
              availability: availability?.status ?? 'OFFLINE',
              lastHeartbeatAt: heartbeat?.toISOString() ?? null,
              heartbeatAgeSeconds: heartbeat ? Math.round((now.getTime() - heartbeat.getTime()) / 1000) : null,
              location: availability?.lat && availability.lng ? { lat: availability.lat.toNumber(), lng: availability.lng.toNumber() } : null,
            }
          : null,
      } satisfies DispatchConsoleRow;
    });

    if (filter.onlyProblem) {
      // Keep the cursor semantics of the underlying page; only the visible rows are narrowed.
      return { items: page.items.filter((r) => r.problems.length > 0), nextCursor: page.nextCursor };
    }
    if (filter.onlyUnassigned) {
      return { items: page.items.filter((r) => isUnassignedStatus(r.job.status) && !r.job.partnerId), nextCursor: page.nextCursor };
    }
    return page;
  }

  /** Full offer history of one job, for the console's drawer. */
  assignmentsForJob(jobId: string) {
    return this.dispatch.assignmentsForJob(jobId);
  }

  /** Everything one partner did today: job status events plus every offer they were sent. */
  async partnerTimeline(partnerId: string, day: Date = new Date()): Promise<PartnerTimelineDto> {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      select: { userId: true, user: { select: { fullName: true, phone: true } }, availability: { select: { status: true, lastHeartbeatAt: true, currentJobId: true } } },
    });
    if (!partner) throw AppException.notFound('Partner', partnerId);

    const from = startOfUtcDay(day);
    const to = new Date(from.getTime() + 86_400_000);
    const [events, assignments] = await Promise.all([
      this.prisma.jobEvent.findMany({
        where: { createdAt: { gte: from, lt: to }, job: { partnerId } },
        select: { id: true, jobId: true, type: true, fromStatus: true, toStatus: true, data: true, createdAt: true, job: { select: { number: true, type: true } } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      }),
      this.prisma.jobAssignment.findMany({
        where: { partnerId, offeredAt: { gte: from, lt: to } },
        select: { id: true, jobId: true, wave: true, status: true, score: true, etaSeconds: true, distanceMeters: true, offeredAt: true, respondedAt: true, job: { select: { number: true, type: true } } },
        orderBy: { offeredAt: 'asc' },
        take: 500,
      }),
    ]);

    const entries: PartnerTimelineEntry[] = [
      ...events.map(
        (e): PartnerTimelineEntry => ({
          kind: 'JOB_EVENT',
          at: e.createdAt.toISOString(),
          jobId: e.jobId,
          jobNumber: e.job.number,
          jobType: e.job.type,
          type: e.type,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          data: (e.data as Record<string, unknown> | null) ?? null,
        }),
      ),
      ...assignments.map(
        (a): PartnerTimelineEntry => ({
          kind: 'ASSIGNMENT',
          at: a.offeredAt.toISOString(),
          jobId: a.jobId,
          jobNumber: a.job.number,
          jobType: a.job.type,
          type: `offer.${a.status.toLowerCase()}`,
          fromStatus: null,
          toStatus: null,
          data: { wave: a.wave, score: a.score.toNumber(), etaSeconds: a.etaSeconds, distanceMeters: a.distanceMeters, respondedAt: a.respondedAt?.toISOString() ?? null },
        }),
      ),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return {
      partnerId: partner.userId,
      fullName: partner.user.fullName,
      phone: partner.user.phone,
      availability: partner.availability?.status ?? 'OFFLINE',
      lastHeartbeatAt: partner.availability?.lastHeartbeatAt?.toISOString() ?? null,
      currentJobId: partner.availability?.currentJobId ?? null,
      from: from.toISOString(),
      to: to.toISOString(),
      entries,
    };
  }
}
