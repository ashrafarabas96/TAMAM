import { NotificationEvent } from '@tamam/shared-types';
import type { PinoLogger } from 'nestjs-pino';

import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

import { DocumentExpiryService } from './document-expiry.service';
import { dayMs } from './domain/document-expiry';

const NOW = new Date('2026-09-03T02:00:00.000Z');
const inDays = (days: number): Date => new Date(NOW.getTime() + days * dayMs);

function prismaMock() {
  return {
    partnerDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    partnerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    partnerAvailability: { update: jest.fn().mockResolvedValue({}) },
  };
}

const loggerMock = (): PinoLogger => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), log: jest.fn() }) as unknown as PinoLogger;

describe('DocumentExpiryService', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let notifications: { notify: jest.Mock };
  let service: DocumentExpiryService;

  beforeEach(() => {
    prisma = prismaMock();
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    service = new DocumentExpiryService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService, loggerMock());
  });

  it('warns once per document and records the claim before notifying', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'PROFESSIONAL_CERTIFICATE', status: 'APPROVED', expiresAt: inDays(10), expiryNotifiedAt: null },
    ]);

    const result = await service.run(NOW);

    expect(result.warned).toBe(1);
    expect(result.expired).toBe(0);
    // The claim UPDATE is conditional on expiry_notified_at still being NULL.
    expect(prisma.partnerDocument.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', expiryNotifiedAt: null }, data: { expiryNotifiedAt: NOW } });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'p1',
        event: NotificationEvent.DOCUMENT_EXPIRING,
        priority: 'high',
        vars: expect.objectContaining({ documentType: 'PROFESSIONAL_CERTIFICATE', days: '10' }),
      }),
    );
  });

  it('does not notify when another worker already claimed the document', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'ID', status: 'APPROVED', expiresAt: inDays(2), expiryNotifiedAt: null },
    ]);
    prisma.partnerDocument.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.run(NOW);

    expect(result.warned).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('releases the claim and rethrows when the notification cannot be queued', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'ID', status: 'APPROVED', expiresAt: inDays(2), expiryNotifiedAt: null },
    ]);
    notifications.notify.mockRejectedValue(new Error('redis down'));

    await expect(service.run(NOW)).rejects.toThrow('redis down');
    expect(prisma.partnerDocument.updateMany).toHaveBeenLastCalledWith({ where: { id: 'd1' }, data: { expiryNotifiedAt: null } });
  });

  it('flags lapsed documents EXPIRED without touching rejected ones', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'ID', status: 'APPROVED', expiresAt: inDays(-1), expiryNotifiedAt: inDays(-15) },
      { id: 'd2', partnerId: 'p1', type: 'DRIVING_LICENSE', status: 'EXPIRED', expiresAt: inDays(-30), expiryNotifiedAt: inDays(-45) },
    ]);
    prisma.partnerDocument.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.run(NOW);

    expect(result.expired).toBe(1);
    expect(prisma.partnerDocument.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['d1'] }, status: { notIn: ['EXPIRED', 'REJECTED'] } },
      data: { status: 'EXPIRED' },
    });
  });

  it('forces a partner offline when a REQUIRED document lapsed', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'PROFESSIONAL_CERTIFICATE', status: 'APPROVED', expiresAt: inDays(-1), expiryNotifiedAt: inDays(-20) },
    ]);
    prisma.partnerProfile.findMany.mockResolvedValue([
      {
        userId: 'p1',
        categories: [{ category: { requiredDocumentTypes: ['ID', 'PROFESSIONAL_CERTIFICATE'] } }],
        documents: [{ type: 'PROFESSIONAL_CERTIFICATE', status: 'EXPIRED', expiresAt: inDays(-1) }],
        availability: { status: 'ONLINE' },
      },
    ]);

    const result = await service.run(NOW);

    expect(result.partnersForcedOffline).toBe(1);
    expect(prisma.partnerAvailability.update).toHaveBeenCalledWith({ where: { partnerId: 'p1' }, data: { status: 'OFFLINE', onlineSince: null } });
  });

  it('leaves a partner online when the lapsed document is not required by their categories', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'INSURANCE', status: 'APPROVED', expiresAt: inDays(-1), expiryNotifiedAt: inDays(-20) },
    ]);
    prisma.partnerProfile.findMany.mockResolvedValue([
      {
        userId: 'p1',
        categories: [{ category: { requiredDocumentTypes: ['ID'] } }],
        documents: [{ type: 'INSURANCE', status: 'EXPIRED', expiresAt: inDays(-1) }],
        availability: { status: 'ONLINE' },
      },
    ]);

    const result = await service.run(NOW);

    expect(result.partnersForcedOffline).toBe(0);
    expect(prisma.partnerAvailability.update).not.toHaveBeenCalled();
  });

  it('does not touch a partner who is already offline', async () => {
    prisma.partnerDocument.findMany.mockResolvedValue([
      { id: 'd1', partnerId: 'p1', type: 'ID', status: 'APPROVED', expiresAt: inDays(-1), expiryNotifiedAt: inDays(-20) },
    ]);
    prisma.partnerProfile.findMany.mockResolvedValue([
      {
        userId: 'p1',
        categories: [{ category: { requiredDocumentTypes: ['ID'] } }],
        documents: [{ type: 'ID', status: 'EXPIRED', expiresAt: inDays(-1) }],
        availability: { status: 'OFFLINE' },
      },
    ]);

    const result = await service.run(NOW);

    expect(result.partnersForcedOffline).toBe(0);
    expect(prisma.partnerAvailability.update).not.toHaveBeenCalled();
  });

  it('does nothing at all when no document is near its expiry', async () => {
    const result = await service.run(NOW);

    expect(result).toEqual({ warned: 0, expired: 0, partnersForcedOffline: 0 });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(prisma.partnerProfile.findMany).not.toHaveBeenCalled();
  });
});
