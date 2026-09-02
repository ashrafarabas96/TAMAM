import type { JobActorType, JobStatus, JobType } from '@tamam/shared-types';

/** In-process domain events emitted by JobsService via EventEmitter2 (names are stable contracts). */
export const JobDomainEvents = {
  CREATED: 'job.created',
  STATUS_CHANGED: 'job.status_changed',
  ASSIGNED: 'job.assigned',
  UNASSIGNED: 'job.unassigned',
  STARTED: 'job.started',
  COMPLETED: 'job.completed',
  CANCELLED: 'job.cancelled',
  NO_PARTNER: 'job.no_partner',
} as const;

export interface JobStatusChangedEvent {
  jobId: string;
  jobType: JobType;
  from: JobStatus;
  to: JobStatus;
  actorType: JobActorType;
  actorId: string | null;
  customerId: string;
  partnerId: string | null;
  zoneId: string;
  at: string;
}

export interface JobCreatedEvent {
  jobId: string;
  jobType: JobType;
  customerId: string;
  zoneId: string;
  scheduling: 'NOW' | 'SCHEDULED';
  scheduledFor: string | null;
}
