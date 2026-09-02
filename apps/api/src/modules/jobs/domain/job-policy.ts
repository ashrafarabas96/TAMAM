import { ACTIVE_JOB_STATUSES, JobActorType, type JobStatus, Permission, UserRole } from '@tamam/shared-types';

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
    return user.isSuperAdmin || user.roles.some((r) => r !== UserRole.CUSTOMER && r !== UserRole.PARTNER);
  },
  canView(user: RequestUser, job: JobLike): boolean {
    if (JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job)) return true;
    return user.isSuperAdmin || user.permissions.includes(Permission.JOBS_READ_ALL);
  },
  canTrack(user: RequestUser, job: JobLike): boolean {
    if (JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job)) return true;
    return user.isSuperAdmin || user.permissions.includes(Permission.TRACKING_VIEW_LIVE_MAP);
  },
  canChat(user: RequestUser, job: JobLike): boolean {
    const active = (ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status);
    if (!active) return user.isSuperAdmin || user.permissions.includes(Permission.SUPPORT_READ);
    return JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job) || user.permissions.includes(Permission.SUPPORT_MANAGE) || user.isSuperAdmin;
  },
  canCancel(user: RequestUser, job: JobLike): boolean {
    return JobPolicy.isCustomer(user, job) || JobPolicy.isAssignedPartner(user, job) || user.isSuperAdmin || user.permissions.includes(Permission.JOBS_CANCEL);
  },
  actorTypeFor(user: RequestUser, job: JobLike): JobActorType {
    if (JobPolicy.isStaff(user)) return JobActorType.ADMIN;
    if (JobPolicy.isAssignedPartner(user, job)) return JobActorType.PARTNER;
    return JobActorType.CUSTOMER;
  },
};
