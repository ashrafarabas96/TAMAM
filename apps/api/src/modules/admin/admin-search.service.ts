import { Injectable } from '@nestjs/common';
import { type JobStatus, type JobType, Permission } from '@tamam/shared-types';
import { adminSearchSchema } from '@tamam/validation';
import type { z } from 'zod';

import type { RequestUser } from '../../common/types/request-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** `@tamam/validation` exports the schema but not the inferred type — derive it here. */
export type AdminSearchInput = z.infer<typeof adminSearchSchema>;

const GROUP_LIMIT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminSearchJobHit {
  id: string;
  number: string;
  type: JobType;
  status: JobStatus;
  customerId: string;
  partnerId: string | null;
  zoneId: string;
  createdAt: string;
}

export interface AdminSearchUserHit {
  id: string;
  fullName: string | null;
  phone: string;
  accountStatus: string;
  createdAt: string;
}

export interface AdminSearchPartnerHit extends AdminSearchUserHit {
  verificationStatus: string;
  availability: string;
}

export interface AdminSearchVehicleHit {
  id: string;
  partnerId: string;
  plate: string;
  brand: string;
  model: string;
  verificationStatus: string;
}

export interface AdminSearchPaymentHit {
  id: string;
  jobId: string;
  status: string;
  method: string;
  provider: string;
  providerRef: string | null;
  amountMinor: number;
  currency: string;
  createdAt: string;
}

export interface AdminSearchTicketHit {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface AdminSearchDisputeHit {
  id: string;
  number: string;
  jobId: string;
  status: string;
  createdAt: string;
}

/**
 * Grouped result. A group is present only when the caller holds the permission that guards the
 * corresponding admin screen; groups the caller may not read are simply absent (spec §139).
 */
export interface AdminSearchResult {
  query: string;
  jobs?: AdminSearchJobHit[];
  customers?: AdminSearchUserHit[];
  partners?: AdminSearchPartnerHit[];
  vehicles?: AdminSearchVehicleHit[];
  payments?: AdminSearchPaymentHit[];
  tickets?: AdminSearchTicketHit[];
  disputes?: AdminSearchDisputeHit[];
}

/**
 * The one search box of the admin panel (spec §139). Matches job numbers, customer/partner
 * phone + name, vehicle plates, payment ids / provider references, ticket and dispute numbers.
 * Every group is permission-checked before it is queried, so an agent without PAYMENTS_READ
 * cannot discover payment ids through search.
 */
@Injectable()
export class AdminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: AdminSearchInput, user: RequestUser): Promise<AdminSearchResult> {
    const q = input.q.trim();
    const upper = q.toUpperCase();
    const plate = q.replace(/[\s-]/g, '').toUpperCase();
    const isUuid = UUID_RE.test(q);
    const result: AdminSearchResult = { query: q };

    if (this.can(user, Permission.JOBS_READ_ALL)) result.jobs = await this.jobs(q, upper, isUuid);
    if (this.can(user, Permission.CUSTOMERS_READ)) result.customers = await this.customers(q, isUuid);
    if (this.can(user, Permission.PARTNERS_READ)) result.partners = await this.partners(q, isUuid);
    if (this.can(user, Permission.PARTNERS_READ)) result.vehicles = await this.vehicles(plate, isUuid ? q : null);
    if (this.can(user, Permission.PAYMENTS_READ)) result.payments = await this.payments(q, isUuid);
    if (this.can(user, Permission.SUPPORT_READ)) result.tickets = await this.tickets(upper);
    if (this.can(user, Permission.DISPUTES_READ)) result.disputes = await this.disputes(upper);
    return result;
  }

  private can(user: RequestUser, permission: Permission): boolean {
    return user.isSuperAdmin || user.permissions.includes(permission);
  }

  private async jobs(q: string, upper: string, isUuid: boolean): Promise<AdminSearchJobHit[]> {
    const rows = await this.prisma.job.findMany({
      where: {
        OR: [
          ...(isUuid ? [{ id: q }] : []),
          { number: { contains: upper } },
          { customer: { user: { phone: { contains: q } } } },
          { partner: { user: { phone: { contains: q } } } },
        ],
      },
      select: { id: true, number: true, type: true, status: true, customerId: true, partnerId: true, zoneId: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  private async customers(q: string, isUuid: boolean): Promise<AdminSearchUserHit[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        customer: { isNot: null },
        OR: [...(isUuid ? [{ id: q }] : []), { phone: { contains: q } }, { fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, fullName: true, phone: true, accountStatus: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  private async partners(q: string, isUuid: boolean): Promise<AdminSearchPartnerHit[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        partner: { isNot: null },
        OR: [...(isUuid ? [{ id: q }] : []), { phone: { contains: q } }, { fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, fullName: true, phone: true, accountStatus: true, createdAt: true, partner: { select: { verificationStatus: true, availability: { select: { status: true } } } } },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      phone: r.phone,
      accountStatus: r.accountStatus,
      createdAt: r.createdAt.toISOString(),
      verificationStatus: r.partner?.verificationStatus ?? 'DRAFT',
      availability: r.partner?.availability?.status ?? 'OFFLINE',
    }));
  }

  private async vehicles(plate: string, id: string | null): Promise<AdminSearchVehicleHit[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: { OR: [...(id ? [{ id }] : []), { plateNormalized: { contains: plate } }] },
      select: { id: true, partnerId: true, plate: true, brand: true, model: true, verificationStatus: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows;
  }

  private async payments(q: string, isUuid: boolean): Promise<AdminSearchPaymentHit[]> {
    const rows = await this.prisma.payment.findMany({
      where: { OR: [...(isUuid ? [{ id: q }] : []), { providerRef: { contains: q } }] },
      select: { id: true, jobId: true, status: true, method: true, provider: true, providerRef: true, amountMinor: true, currency: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({ ...r, amountMinor: Number(r.amountMinor), createdAt: r.createdAt.toISOString() }));
  }

  private async tickets(upper: string): Promise<AdminSearchTicketHit[]> {
    const rows = await this.prisma.supportTicket.findMany({
      where: { OR: [{ number: { contains: upper } }, { subject: { contains: upper, mode: 'insensitive' } }] },
      select: { id: true, number: true, subject: true, status: true, priority: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  private async disputes(upper: string): Promise<AdminSearchDisputeHit[]> {
    const rows = await this.prisma.dispute.findMany({
      where: { number: { contains: upper } },
      select: { id: true, number: true, jobId: true, status: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }],
      take: GROUP_LIMIT,
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}
