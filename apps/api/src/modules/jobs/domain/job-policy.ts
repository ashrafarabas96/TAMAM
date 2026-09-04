import {
  ACTIVE_JOB_STATUSES,
  JobActorType,
  type JobStatus,
  Permission,
  UserRole,
} from '@tamam/shared-types';

import type { RequestUser } from '../../../common/types/request-user';

export interface JobLike {
  id: string;
  customerId: string;
  partnerId: string | null;
  status: JobStatus;
  zoneId: string;
}

/**
 * Object-level authorization for jobs (spec §88). Pure functions — no I/O — so every
 * module (chat, tracking, disputes, payments, support) applies identical rules.
 */
export const JobPolicy = {
  isCustomer(user: RequestUser, job: JobLike): boolean {
    return user.customerId === job.customerId || user.id === job.customerId;
  },
  isAssignedPartner(user: RequestUser, job: JobLike): boolean {
    return !!job.partnerId && (user.partnerId === job.partnerId || user.id === job.partnerId);
  },
  isStaff(user: RequestUser): boolean {
    return (
      user.isSuperAdmin || user.roles.some((r) => r !== UserRole.CUSTOMER && r !== UserRole.PARTNER)
    );
  },
  canView(user: RequestUser, job: JobLike): boolean {
    if (JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job)) return true;
    return user.isSuperAdmin || user.permissions.includes(Permission.JOBS_READ_ALL);
  },
  canTrack(user: RequestUser, job: JobLike): boolean {
    if (JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job)) return true;
    return user.isSuperAdmin || user.permissions.includes(Permission.TRACKING_VIEW_LIVE_MAP);
  },
  /**
   * Reading a transcript is a read of the job, so anyone who may read every job may read its
   * chat. Requiring a support permission locked dispatchers out of conversations for jobs
   * they are otherwise responsible for.
   */
  canReadChat(user: RequestUser, job: JobLike): boolean {
    if (JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job)) return true;
    return (
      user.isSuperAdmin ||
      user.permissions.includes(Permission.JOBS_READ_ALL) ||
      user.permissions.includes(Permission.SUPPORT_READ)
    );
  },
  /**
   * Posting into a conversation is narrower: the two parties while the job is live, or an
   * agent who may act on support conversations.
   */
  canChat(user: RequestUser, job: JobLike): boolean {
    const active = (ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status);
    if (!active) return user.isSuperAdmin || user.permissions.includes(Permission.SUPPORT_MANAGE);
    return (
      JobPolicy.isCustomer(user, job) ||
      JobPolicy.isAssignedPartner(user, job) ||
      user.permissions.includes(Permission.SUPPORT_MANAGE) ||
      user.isSuperAdmin
    );
  },
  canCancel(user: RequestUser, job: JobLike): boolean {
    return (
      JobPolicy.isCustomer(user, job) ||
      JobPolicy.isAssignedPartner(user, job) ||
      user.isSuperAdmin ||
      user.permissions.includes(Permission.JOBS_CANCEL)
    );
  },
  actorTypeFor(user: RequestUser, job: JobLike): JobActorType {
    if (JobPolicy.isStaff(user)) return JobActorType.ADMIN;
    if (JobPolicy.isAssignedPartner(user, job)) return JobActorType.PARTNER;
    return JobActorType.CUSTOMER;
  },
};
