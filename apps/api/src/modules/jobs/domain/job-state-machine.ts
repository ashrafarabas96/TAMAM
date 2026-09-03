import { type JobActorType, type JobStatus, type JobTransition, type JobType, TERMINAL_JOB_STATUSES, allowedTargets, findTransition } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';

/**
 * The only place a job status may change (spec §18, §40). Wraps the shared JOB_TRANSITIONS
 * table; JobsService.transition() calls `assert` inside a row-locked transaction.
 */
export const JobStateMachine = {
  assert(job: { type: JobType; status: JobStatus }, to: JobStatus, actor: JobActorType): JobTransition {
    const t = findTransition(job.status, to, job.type, actor);
    if (!t) throw AppException.invalidTransition(job.status, to);
    return t;
  },
  can(job: { type: JobType; status: JobStatus }, to: JobStatus, actor: JobActorType): boolean {
    return !!findTransition(job.status, to, job.type, actor);
  },
  targets(job: { type: JobType; status: JobStatus }, actor: JobActorType): JobStatus[] {
    return allowedTargets(job.status, job.type, actor);
  },
  isTerminal(status: JobStatus): boolean {
    return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
  },
};
