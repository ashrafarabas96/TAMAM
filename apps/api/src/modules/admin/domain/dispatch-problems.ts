import { JobStatus } from '@tamam/shared-types';

/** Why a live job needs a dispatcher's attention (spec §140). */
export const DispatchProblem = {
  /** SEARCHING/REQUESTED with nobody assigned yet. */
  UNASSIGNED: 'UNASSIGNED',
  /** Every wave was exhausted without an acceptance. */
  NO_PARTNER_AVAILABLE: 'NO_PARTNER_AVAILABLE',
  /** ASSIGNED for longer than the grace window without the partner going en route. */
  ASSIGNED_NOT_MOVING: 'ASSIGNED_NOT_MOVING',
  /** En route for more than twice the promised pickup ETA. */
  ETA_EXCEEDED: 'ETA_EXCEEDED',
  /** Partner arrived and the customer has not shown up. */
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  /** No heartbeat from the assigned partner within the offline threshold. */
  PARTNER_HEARTBEAT_STALE: 'PARTNER_HEARTBEAT_STALE',
} as const;
export type DispatchProblem = (typeof DispatchProblem)[keyof typeof DispatchProblem];

export interface ProblemInput {
  status: JobStatus;
  partnerId: string | null;
  assignedAt: Date | null;
  /** Timestamp of the PARTNER_EN_ROUTE transition, when it happened. */
  enRouteAt: Date | null;
  /** Promised ETA to pickup in seconds (assignment ETA, falling back to the job's). */
  etaToPickupSeconds: number | null;
  /** Last heartbeat of the assigned partner. */
  partnerLastHeartbeatAt: Date | null;
}

export interface ProblemThresholds {
  /** Seconds a job may stay ASSIGNED before the partner is expected to move. */
  assignedGraceSeconds: number;
  /** Multiple of the promised ETA after which an en-route job is late. */
  etaOverdueFactor: number;
  /** Seconds without a heartbeat before the assigned partner counts as stale. */
  heartbeatStaleSeconds: number;
}

export const DEFAULT_PROBLEM_THRESHOLDS: ProblemThresholds = {
  assignedGraceSeconds: 600, // 10 minutes (spec §140)
  etaOverdueFactor: 2,
  heartbeatStaleSeconds: 120,
};

const UNASSIGNED_STATUSES: readonly JobStatus[] = [JobStatus.REQUESTED, JobStatus.SEARCHING, JobStatus.NO_PARTNER_AVAILABLE];

export function isUnassignedStatus(status: JobStatus): boolean {
  return UNASSIGNED_STATUSES.includes(status);
}

/**
 * Pure classifier: returns every problem that applies to a job right now. An empty array
 * means the job is progressing normally and should not be highlighted in the console.
 */
export function classifyProblems(input: ProblemInput, thresholds: ProblemThresholds = DEFAULT_PROBLEM_THRESHOLDS, now: Date = new Date()): DispatchProblem[] {
  const problems: DispatchProblem[] = [];
  const seconds = (from: Date | null): number | null => (from ? (now.getTime() - from.getTime()) / 1000 : null);

  if (input.status === JobStatus.NO_PARTNER_AVAILABLE) problems.push(DispatchProblem.NO_PARTNER_AVAILABLE);
  else if (isUnassignedStatus(input.status) && !input.partnerId) problems.push(DispatchProblem.UNASSIGNED);

  if (input.status === JobStatus.ASSIGNED) {
    const waited = seconds(input.assignedAt);
    if (waited !== null && waited > thresholds.assignedGraceSeconds) problems.push(DispatchProblem.ASSIGNED_NOT_MOVING);
  }

  if (input.status === JobStatus.PARTNER_EN_ROUTE) {
    const eta = input.etaToPickupSeconds;
    const elapsed = seconds(input.enRouteAt ?? input.assignedAt);
    if (eta !== null && eta > 0 && elapsed !== null && elapsed > eta * thresholds.etaOverdueFactor) problems.push(DispatchProblem.ETA_EXCEEDED);
  }

  if (input.status === JobStatus.WAITING_CUSTOMER) problems.push(DispatchProblem.WAITING_CUSTOMER);

  if (input.partnerId) {
    const since = seconds(input.partnerLastHeartbeatAt);
    if (since === null || since > thresholds.heartbeatStaleSeconds) problems.push(DispatchProblem.PARTNER_HEARTBEAT_STALE);
  }

  return problems;
}
