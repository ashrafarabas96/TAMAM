import { AccountStatus, Permission, UserRole } from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { AdminSearchService } from './admin-search.service';

const NOW = new Date('2026-09-03T09:00:00.000Z');

function prismaMock() {
  return {
    job: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    supportTicket: { findMany: jest.fn().mockResolvedValue([]) },
    dispute: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function principal(permissions: Permission[], isSuperAdmin = false): RequestUser {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    phone: '+970599000010',
    roles: [UserRole.SUPPORT],
    permissions,
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'session',
    deviceId: 'device',
    language: 'ar',
    isSuperAdmin,
  };
}

describe('AdminSearchService', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: AdminSearchService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new AdminSearchService(prisma as unknown as PrismaService);
  });

  it('only queries the groups the caller is allowed to read', async () => {
    const result = await service.search({ q: 'TM-2609' }, principal([Permission.JOBS_READ_ALL]));

    expect(result.jobs).toEqual([]);
    expect(result.customers).toBeUndefined();
    expect(result.partners).toBeUndefined();
    expect(result.vehicles).toBeUndefined();
    expect(result.payments).toBeUndefined();
    expect(result.tickets).toBeUndefined();
    expect(result.disputes).toBeUndefined();

    expect(prisma.job.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('gives a SUPER_ADMIN every group without listing permissions', async () => {
    const result = await service.search({ q: 'sara' }, principal([], true));

    expect(Object.keys(result).sort()).toEqual([
      'customers',
      'disputes',
      'jobs',
      'partners',
      'payments',
      'query',
      'tickets',
      'vehicles',
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(2); // customers + partners
  });

  it('searches jobs by number, and by both parties’ phone numbers', async () => {
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        number: 'TM-2609-000001',
        type: 'RIDE',
        status: 'COMPLETED',
        customerId: 'c1',
        partnerId: 'p1',
        zoneId: 'z1',
        createdAt: NOW,
      },
    ]);

    const result = await service.search(
      { q: 'tm-2609-000001' },
      principal([Permission.JOBS_READ_ALL]),
    );

    expect(result.jobs).toEqual([
      {
        id: 'j1',
        number: 'TM-2609-000001',
        type: 'RIDE',
        status: 'COMPLETED',
        customerId: 'c1',
        partnerId: 'p1',
        zoneId: 'z1',
        createdAt: NOW.toISOString(),
      },
    ]);
    const where = prisma.job.findMany.mock.calls[0]?.[0].where as {
      OR: Array<Record<string, unknown>>;
    };
    // The query is upper-cased for job numbers and kept verbatim for phone matching.
    expect(where.OR).toContainEqual({ number: { contains: 'TM-2609-000001' } });
    expect(where.OR).toContainEqual({
      customer: { user: { phone: { contains: 'tm-2609-000001' } } },
    });
    expect(where.OR).toContainEqual({
      partner: { user: { phone: { contains: 'tm-2609-000001' } } },
    });
  });

  it('adds an id lookup only when the query is a UUID', async () => {
    await service.search({ q: 'not-a-uuid' }, principal([Permission.JOBS_READ_ALL]));
    let where = prisma.job.findMany.mock.calls[0]?.[0].where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR.some((c) => 'id' in c)).toBe(false);

    prisma.job.findMany.mockClear();
    const uuid = '9f1c2a44-0d4e-4a4b-9d20-1a2b3c4d5e6f';
    await service.search({ q: uuid }, principal([Permission.JOBS_READ_ALL]));
    where = prisma.job.findMany.mock.calls[0]?.[0].where as { OR: Array<Record<string, unknown>> };
    expect(where.OR).toContainEqual({ id: uuid });
  });

  it('normalises vehicle plates before matching', async () => {
    await service.search({ q: '12-34 567' }, principal([Permission.PARTNERS_READ]));

    const where = prisma.vehicle.findMany.mock.calls[0]?.[0].where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR).toContainEqual({ plateNormalized: { contains: '1234567' } });
  });

  it('maps partner rows with their verification and availability state', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        fullName: 'محمد خليل',
        phone: '+970599000002',
        accountStatus: 'ACTIVE',
        createdAt: NOW,
        partner: { verificationStatus: 'APPROVED', availability: { status: 'ONLINE' } },
      },
    ]);

    const result = await service.search({ q: '0599000002' }, principal([Permission.PARTNERS_READ]));

    expect(result.partners).toEqual([
      {
        id: 'u1',
        fullName: 'محمد خليل',
        phone: '+970599000002',
        accountStatus: 'ACTIVE',
        createdAt: NOW.toISOString(),
        verificationStatus: 'APPROVED',
        availability: 'ONLINE',
      },
    ]);
  });

  it('serialises payment amounts as numbers, never BigInt', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay1',
        jobId: 'j1',
        status: 'CAPTURED',
        method: 'CASH',
        provider: 'cash',
        providerRef: null,
        amountMinor: 2350n,
        currency: 'ILS',
        createdAt: NOW,
      },
    ]);

    const result = await service.search({ q: 'pay' }, principal([Permission.PAYMENTS_READ]));

    expect(result.payments?.[0]?.amountMinor).toBe(2350);
    expect(typeof result.payments?.[0]?.amountMinor).toBe('number');
  });

  it('caps every group so one query cannot scan the platform', async () => {
    await service.search({ q: 'a' + 'b'.repeat(10) }, principal([], true));

    for (const call of [
      prisma.job.findMany,
      prisma.user.findMany,
      prisma.vehicle.findMany,
      prisma.payment.findMany,
      prisma.supportTicket.findMany,
      prisma.dispute.findMany,
    ]) {
      expect(call.mock.calls[0]?.[0].take).toBe(10);
    }
  });
});
