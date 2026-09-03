import { JobActorType, JobStatus, JobType } from '@tamam/shared-types';

import { JobStateMachine } from './job-state-machine';

describe('JobStateMachine', () => {
  it('allows the canonical ride path', () => {
    const path: JobStatus[] = [JobStatus.REQUESTED, JobStatus.SEARCHING, JobStatus.ASSIGNED, JobStatus.PARTNER_EN_ROUTE, JobStatus.PARTNER_ARRIVED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED];
    const actors: JobActorType[] = [JobActorType.CUSTOMER, JobActorType.SYSTEM, JobActorType.SYSTEM, JobActorType.PARTNER, JobActorType.PARTNER, JobActorType.PARTNER, JobActorType.PARTNER];
    let status: JobStatus = JobStatus.DRAFT;
    path.forEach((to, i) => {
      const actor = actors[i];
      if (!actor) throw new Error('actor missing');
      JobStateMachine.assert({ type: JobType.RIDE, status }, to, actor);
      status = to;
    });
    expect(status).toBe(JobStatus.COMPLETED);
  });

  it('rejects ASSIGNED -> IN_PROGRESS directly (spec §18)', () => {
    expect(() => JobStateMachine.assert({ type: JobType.RIDE, status: JobStatus.ASSIGNED }, JobStatus.IN_PROGRESS, JobActorType.PARTNER)).toThrow();
  });

  it('rejects mobility-only transitions for home services', () => {
    expect(JobStateMachine.can({ type: JobType.HOME_SERVICE, status: JobStatus.PARTNER_ARRIVED }, JobStatus.IN_PROGRESS, JobActorType.PARTNER)).toBe(false);
    expect(JobStateMachine.can({ type: JobType.HOME_SERVICE, status: JobStatus.PARTNER_ARRIVED }, JobStatus.INSPECTION_STARTED, JobActorType.PARTNER)).toBe(true);
  });

  it('forbids customers from completing jobs', () => {
    expect(JobStateMachine.can({ type: JobType.RIDE, status: JobStatus.IN_PROGRESS }, JobStatus.COMPLETED, JobActorType.CUSTOMER)).toBe(false);
  });

  it('forbids partners from cancelling an in-progress ride', () => {
    expect(JobStateMachine.can({ type: JobType.RIDE, status: JobStatus.IN_PROGRESS }, JobStatus.CANCELLED, JobActorType.PARTNER)).toBe(false);
    expect(JobStateMachine.can({ type: JobType.RIDE, status: JobStatus.IN_PROGRESS }, JobStatus.CANCELLED, JobActorType.ADMIN)).toBe(true);
  });

  it('requires quote approval before work starts', () => {
    expect(JobStateMachine.can({ type: JobType.HOME_SERVICE, status: JobStatus.QUOTE_SUBMITTED }, JobStatus.WORK_STARTED, JobActorType.PARTNER)).toBe(false);
    expect(JobStateMachine.can({ type: JobType.HOME_SERVICE, status: JobStatus.QUOTE_APPROVED }, JobStatus.WORK_STARTED, JobActorType.PARTNER)).toBe(true);
  });

  it('never leaves a terminal state except COMPLETED -> DISPUTED', () => {
    expect(JobStateMachine.targets({ type: JobType.RIDE, status: JobStatus.CANCELLED }, JobActorType.ADMIN)).toEqual([]);
    expect(JobStateMachine.targets({ type: JobType.RIDE, status: JobStatus.COMPLETED }, JobActorType.CUSTOMER)).toEqual([JobStatus.DISPUTED]);
  });
});
