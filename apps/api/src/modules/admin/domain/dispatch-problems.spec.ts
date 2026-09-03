import { JobStatus } from '@tamam/shared-types';

import { DEFAULT_PROBLEM_THRESHOLDS, DispatchProblem, type ProblemInput, classifyProblems, isUnassignedStatus } from './dispatch-problems';

const NOW = new Date('2026-09-03T12:00:00.000Z');
const secondsAgo = (s: number): Date => new Date(NOW.getTime() - s * 1000);

function input(overrides: Partial<ProblemInput> = {}): ProblemInput {
  return {
    status: JobStatus.ASSIGNED,
    partnerId: 'partner-1',
    assignedAt: secondsAgo(60),
    enRouteAt: null,
    etaToPickupSeconds: 300,
    partnerLastHeartbeatAt: secondsAgo(10),
    ...overrides,
  };
}

describe('classifyProblems', () => {
  it('returns nothing for a job that is progressing normally', () => {
    expect(classifyProblems(input(), DEFAULT_PROBLEM_THRESHOLDS, NOW)).toEqual([]);
  });

  it('flags a job nobody has taken', () => {
    const problems = classifyProblems(input({ status: JobStatus.SEARCHING, partnerId: null, assignedAt: null, partnerLastHeartbeatAt: null }), DEFAULT_PROBLEM_THRESHOLDS, NOW);
    expect(problems).toEqual([DispatchProblem.UNASSIGNED]);
  });

  it('flags an exhausted search separately from a fresh one', () => {
    const problems = classifyProblems(input({ status: JobStatus.NO_PARTNER_AVAILABLE, partnerId: null, assignedAt: null }), DEFAULT_PROBLEM_THRESHOLDS, NOW);
    expect(problems).toEqual([DispatchProblem.NO_PARTNER_AVAILABLE]);
  });

  it('flags a partner who accepted but has not started moving after the grace window', () => {
    const justInside = classifyProblems(input({ assignedAt: secondsAgo(DEFAULT_PROBLEM_THRESHOLDS.assignedGraceSeconds) }), DEFAULT_PROBLEM_THRESHOLDS, NOW);
    expect(justInside).not.toContain(DispatchProblem.ASSIGNED_NOT_MOVING);

    const late = classifyProblems(input({ assignedAt: secondsAgo(DEFAULT_PROBLEM_THRESHOLDS.assignedGraceSeconds + 1) }), DEFAULT_PROBLEM_THRESHOLDS, NOW);
    expect(late).toContain(DispatchProblem.ASSIGNED_NOT_MOVING);
  });

  it('flags an en-route job only after twice the promised ETA', () => {
    const onTime = classifyProblems(
      input({ status: JobStatus.PARTNER_EN_ROUTE, enRouteAt: secondsAgo(500), etaToPickupSeconds: 300 }),
      DEFAULT_PROBLEM_THRESHOLDS,
      NOW,
    );
    expect(onTime).not.toContain(DispatchProblem.ETA_EXCEEDED);

    const late = classifyProblems(
      input({ status: JobStatus.PARTNER_EN_ROUTE, enRouteAt: secondsAgo(601), etaToPickupSeconds: 300 }),
      DEFAULT_PROBLEM_THRESHOLDS,
      NOW,
    );
    expect(late).toContain(DispatchProblem.ETA_EXCEEDED);
  });

  it('falls back to assignedAt when the en-route timestamp is unknown', () => {
    const problems = classifyProblems(
      input({ status: JobStatus.PARTNER_EN_ROUTE, enRouteAt: null, assignedAt: secondsAgo(1000), etaToPickupSeconds: 300 }),
      DEFAULT_PROBLEM_THRESHOLDS,
      NOW,
    );
    expect(problems).toContain(DispatchProblem.ETA_EXCEEDED);
  });

  it('never flags an ETA problem when no ETA was promised', () => {
    const problems = classifyProblems(
      input({ status: JobStatus.PARTNER_EN_ROUTE, enRouteAt: secondsAgo(9999), etaToPickupSeconds: null }),
      DEFAULT_PROBLEM_THRESHOLDS,
      NOW,
    );
    expect(problems).not.toContain(DispatchProblem.ETA_EXCEEDED);
  });

  it('always flags a job waiting on the customer', () => {
    expect(classifyProblems(input({ status: JobStatus.WAITING_CUSTOMER }), DEFAULT_PROBLEM_THRESHOLDS, NOW)).toContain(DispatchProblem.WAITING_CUSTOMER);
  });

  it('flags a silent partner device', () => {
    expect(classifyProblems(input({ partnerLastHeartbeatAt: secondsAgo(121) }), DEFAULT_PROBLEM_THRESHOLDS, NOW)).toContain(DispatchProblem.PARTNER_HEARTBEAT_STALE);
    expect(classifyProblems(input({ partnerLastHeartbeatAt: null }), DEFAULT_PROBLEM_THRESHOLDS, NOW)).toContain(DispatchProblem.PARTNER_HEARTBEAT_STALE);
  });

  it('does not report a heartbeat problem for an unassigned job', () => {
    const problems = classifyProblems(input({ status: JobStatus.SEARCHING, partnerId: null, partnerLastHeartbeatAt: null, assignedAt: null }), DEFAULT_PROBLEM_THRESHOLDS, NOW);
    expect(problems).not.toContain(DispatchProblem.PARTNER_HEARTBEAT_STALE);
  });

  it('can report several problems at once', () => {
    const problems = classifyProblems(
      input({ status: JobStatus.WAITING_CUSTOMER, partnerLastHeartbeatAt: secondsAgo(600) }),
      DEFAULT_PROBLEM_THRESHOLDS,
      NOW,
    );
    expect(problems).toEqual([DispatchProblem.WAITING_CUSTOMER, DispatchProblem.PARTNER_HEARTBEAT_STALE]);
  });
});

describe('isUnassignedStatus', () => {
  it('covers exactly the pre-assignment statuses', () => {
    expect(isUnassignedStatus(JobStatus.REQUESTED)).toBe(true);
    expect(isUnassignedStatus(JobStatus.SEARCHING)).toBe(true);
    expect(isUnassignedStatus(JobStatus.NO_PARTNER_AVAILABLE)).toBe(true);
    expect(isUnassignedStatus(JobStatus.ASSIGNED)).toBe(false);
    expect(isUnassignedStatus(JobStatus.COMPLETED)).toBe(false);
  });
});
