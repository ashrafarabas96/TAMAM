import { JobActorType, JobStatus, JobType } from './enums';

/**
 * Explicit Job state transitions. This table is the ONLY authority on which status
 * changes are legal, who may trigger them and for which job types.
 *
 * The API enforces it inside JobStateMachine (with a DB transaction + optimistic version).
 * The admin UI uses it to render timelines and the mobile apps mirror it (Dart copy generated
 * by scripts/generate-dart-enums.mjs) purely for display — never for decisions.
 */
export interface JobTransition {
  from: JobStatus;
  to: JobStatus;
  /** Who is allowed to trigger it. SYSTEM covers dispatch engine, schedulers, timeouts. */
  actors: readonly JobActorType[];
  /** Job types the transition applies to. Omit = all types. */
  jobTypes?: readonly JobType[];
  /** Human-readable event name persisted into job_events. */
  event: string;
}

const S = JobStatus;
const A = JobActorType;
const MOBILITY: readonly JobType[] = [JobType.RIDE, JobType.DELIVERY];
const HOME: readonly JobType[] = [JobType.HOME_SERVICE];

export const JOB_TRANSITIONS: readonly JobTransition[] = [
  // creation
  { from: S.DRAFT, to: S.REQUESTED, actors: [A.CUSTOMER, A.ADMIN], event: 'job.requested' },
  { from: S.REQUESTED, to: S.SEARCHING, actors: [A.SYSTEM, A.ADMIN], event: 'dispatch.started' },
  { from: S.SEARCHING, to: S.ASSIGNED, actors: [A.SYSTEM, A.ADMIN], event: 'partner.assigned' },
  {
    from: S.SEARCHING,
    to: S.NO_PARTNER_AVAILABLE,
    actors: [A.SYSTEM, A.ADMIN],
    event: 'dispatch.exhausted',
  },
  {
    from: S.NO_PARTNER_AVAILABLE,
    to: S.SEARCHING,
    actors: [A.CUSTOMER, A.ADMIN, A.SYSTEM],
    event: 'dispatch.retried',
  },

  // partner movement (all types)
  {
    from: S.ASSIGNED,
    to: S.PARTNER_EN_ROUTE,
    actors: [A.PARTNER, A.ADMIN],
    event: 'partner.en_route',
  },
  {
    from: S.PARTNER_EN_ROUTE,
    to: S.PARTNER_ARRIVED,
    actors: [A.PARTNER, A.ADMIN, A.SYSTEM],
    event: 'partner.arrived',
  },
  {
    from: S.PARTNER_ARRIVED,
    to: S.WAITING_CUSTOMER,
    actors: [A.SYSTEM, A.PARTNER],
    event: 'partner.waiting',
  },

  // reassignment paths (dispatcher / partner cancel before start)
  {
    from: S.ASSIGNED,
    to: S.SEARCHING,
    actors: [A.PARTNER, A.ADMIN, A.SYSTEM],
    event: 'partner.unassigned',
  },
  {
    from: S.PARTNER_EN_ROUTE,
    to: S.SEARCHING,
    actors: [A.PARTNER, A.ADMIN, A.SYSTEM],
    event: 'partner.unassigned',
  },
  { from: S.PARTNER_ARRIVED, to: S.SEARCHING, actors: [A.ADMIN], event: 'partner.unassigned' },
  { from: S.WAITING_CUSTOMER, to: S.SEARCHING, actors: [A.ADMIN], event: 'partner.unassigned' },

  // mobility start / finish
  {
    from: S.PARTNER_ARRIVED,
    to: S.IN_PROGRESS,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: MOBILITY,
    event: 'job.started',
  },
  {
    from: S.WAITING_CUSTOMER,
    to: S.IN_PROGRESS,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: MOBILITY,
    event: 'job.started',
  },
  {
    from: S.IN_PROGRESS,
    to: S.COMPLETED,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: MOBILITY,
    event: 'job.completed',
  },

  // home service flow
  {
    from: S.PARTNER_ARRIVED,
    to: S.INSPECTION_STARTED,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: HOME,
    event: 'inspection.started',
  },
  {
    from: S.WAITING_CUSTOMER,
    to: S.INSPECTION_STARTED,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: HOME,
    event: 'inspection.started',
  },
  {
    from: S.INSPECTION_STARTED,
    to: S.QUOTE_REQUIRED,
    actors: [A.PARTNER, A.SYSTEM],
    jobTypes: HOME,
    event: 'quote.required',
  },
  {
    from: S.INSPECTION_STARTED,
    to: S.WORK_STARTED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'work.started',
  }, // fixed-price categories skip quote (workflow config)
  {
    from: S.QUOTE_REQUIRED,
    to: S.QUOTE_SUBMITTED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'quote.submitted',
  },
  {
    from: S.QUOTE_SUBMITTED,
    to: S.QUOTE_APPROVED,
    actors: [A.CUSTOMER, A.ADMIN],
    jobTypes: HOME,
    event: 'quote.approved',
  },
  {
    from: S.QUOTE_SUBMITTED,
    to: S.QUOTE_REJECTED,
    actors: [A.CUSTOMER, A.ADMIN],
    jobTypes: HOME,
    event: 'quote.rejected',
  },
  {
    from: S.QUOTE_REJECTED,
    to: S.QUOTE_SUBMITTED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'quote.resubmitted',
  },
  {
    from: S.QUOTE_REJECTED,
    to: S.COMPLETED,
    actors: [A.SYSTEM, A.ADMIN, A.CUSTOMER],
    jobTypes: HOME,
    event: 'job.completed_inspection_only',
  }, // inspection fee only
  {
    from: S.QUOTE_APPROVED,
    to: S.WORK_STARTED,
    actors: [A.PARTNER, A.ADMIN],
    jobTypes: HOME,
    event: 'work.started',
  },
  {
    from: S.WORK_STARTED,
    to: S.WAITING_FOR_PARTS,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'work.waiting_for_parts',
  },
  {
    from: S.WAITING_FOR_PARTS,
    to: S.WORK_STARTED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'work.resumed',
  },
  {
    from: S.WORK_STARTED,
    to: S.QUOTE_SUBMITTED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'change_order.submitted',
  }, // additional work needs approval
  {
    from: S.WORK_STARTED,
    to: S.WORK_COMPLETED,
    actors: [A.PARTNER],
    jobTypes: HOME,
    event: 'work.completed',
  },
  {
    from: S.WORK_COMPLETED,
    to: S.CUSTOMER_CONFIRMED,
    actors: [A.CUSTOMER, A.SYSTEM, A.ADMIN],
    jobTypes: HOME,
    event: 'customer.confirmed',
  }, // SYSTEM = auto-confirm after window
  {
    from: S.CUSTOMER_CONFIRMED,
    to: S.COMPLETED,
    actors: [A.SYSTEM, A.ADMIN],
    jobTypes: HOME,
    event: 'job.completed',
  },
  {
    from: S.WORK_COMPLETED,
    to: S.DISPUTED,
    actors: [A.CUSTOMER, A.ADMIN],
    jobTypes: HOME,
    event: 'job.disputed',
  },

  // cancellation (policy engine decides fee)
  {
    from: S.REQUESTED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN, A.SYSTEM],
    event: 'job.cancelled',
  },
  {
    from: S.SEARCHING,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN, A.SYSTEM],
    event: 'job.cancelled',
  },
  {
    from: S.NO_PARTNER_AVAILABLE,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN, A.SYSTEM],
    event: 'job.cancelled',
  },
  { from: S.ASSIGNED, to: S.CANCELLED, actors: [A.CUSTOMER, A.ADMIN], event: 'job.cancelled' },
  {
    from: S.PARTNER_EN_ROUTE,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN],
    event: 'job.cancelled',
  },
  {
    from: S.PARTNER_ARRIVED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.PARTNER, A.ADMIN],
    event: 'job.cancelled',
  },
  {
    from: S.WAITING_CUSTOMER,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.PARTNER, A.ADMIN, A.SYSTEM],
    event: 'job.cancelled',
  },
  {
    from: S.INSPECTION_STARTED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN],
    jobTypes: HOME,
    event: 'job.cancelled',
  },
  {
    from: S.QUOTE_REQUIRED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.PARTNER, A.ADMIN],
    jobTypes: HOME,
    event: 'job.cancelled',
  },
  {
    from: S.QUOTE_SUBMITTED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN, A.SYSTEM],
    jobTypes: HOME,
    event: 'job.cancelled',
  },
  {
    from: S.QUOTE_APPROVED,
    to: S.CANCELLED,
    actors: [A.CUSTOMER, A.ADMIN],
    jobTypes: HOME,
    event: 'job.cancelled',
  },
  { from: S.IN_PROGRESS, to: S.CANCELLED, actors: [A.ADMIN], event: 'job.cancelled' },
  {
    from: S.WORK_STARTED,
    to: S.CANCELLED,
    actors: [A.ADMIN],
    jobTypes: HOME,
    event: 'job.cancelled',
  },

  // disputes
  {
    from: S.COMPLETED,
    to: S.DISPUTED,
    actors: [A.CUSTOMER, A.PARTNER, A.ADMIN],
    event: 'job.disputed',
  },
  { from: S.DISPUTED, to: S.COMPLETED, actors: [A.ADMIN], event: 'dispute.resolved' },
];

export function findTransition(
  from: JobStatus,
  to: JobStatus,
  jobType: JobType,
  actor: JobActorType,
): JobTransition | undefined {
  return JOB_TRANSITIONS.find(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.actors.includes(actor) &&
      (!t.jobTypes || t.jobTypes.includes(jobType)),
  );
}

export function allowedTargets(
  from: JobStatus,
  jobType: JobType,
  actor: JobActorType,
): JobStatus[] {
  return JOB_TRANSITIONS.filter(
    (t) =>
      t.from === from && t.actors.includes(actor) && (!t.jobTypes || t.jobTypes.includes(jobType)),
  ).map((t) => t.to);
}

/** Statuses in which the assigned partner is considered "on a job" for availability purposes. */
export const PARTNER_BUSY_STATUSES: readonly JobStatus[] = [
  S.ASSIGNED,
  S.PARTNER_EN_ROUTE,
  S.PARTNER_ARRIVED,
  S.WAITING_CUSTOMER,
  S.IN_PROGRESS,
  S.INSPECTION_STARTED,
  S.QUOTE_REQUIRED,
  S.QUOTE_SUBMITTED,
  S.QUOTE_APPROVED,
  S.WORK_STARTED,
  S.WAITING_FOR_PARTS,
];

/** Statuses where cancellation by the customer may incur a fee (partner already committed). */
export const CANCELLATION_FEE_ELIGIBLE_STATUSES: readonly JobStatus[] = [
  S.ASSIGNED,
  S.PARTNER_EN_ROUTE,
  S.PARTNER_ARRIVED,
  S.WAITING_CUSTOMER,
  S.INSPECTION_STARTED,
  S.QUOTE_REQUIRED,
  S.QUOTE_SUBMITTED,
  S.QUOTE_APPROVED,
];
