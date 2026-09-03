import { Injectable } from '@nestjs/common';
import { AvailabilityStatus, DocumentStatus, NotificationEvent } from '@tamam/shared-types';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerAvailabilityService } from '../partners/partner-availability.service';

import { DOCUMENT_EXPIRY_WARNING_DAYS, type ExpiringDocument, dayMs, daysUntil, documentsToExpire, documentsToWarn } from './domain/document-expiry';

export interface DocumentExpiryResult {
  warned: number;
  expired: number;
  partnersForcedOffline: number;
}

/**
 * Partner document lifecycle (spec §160):
 *  1. warn once, 14 days before a document lapses (`expiry_notified_at` is the idempotency key),
 *  2. flag lapsed documents EXPIRED,
 *  3. force partners whose *required* documents lapsed OFFLINE so dispatch stops offering work.
 *
 * Runs from the maintenance queue; every step is idempotent so a retry cannot double-notify.
 */
@Injectable()
export class DocumentExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly logger: PinoLogger,
  ) {}

  async run(now: Date = new Date()): Promise<DocumentExpiryResult> {
    const horizon = new Date(now.getTime() + DOCUMENT_EXPIRY_WARNING_DAYS * dayMs);
    const candidates: ExpiringDocument[] = await this.prisma.partnerDocument.findMany({
      where: { expiresAt: { not: null, lte: horizon }, status: { notIn: [DocumentStatus.REJECTED] } },
      select: { id: true, partnerId: true, type: true, status: true, expiresAt: true, expiryNotifiedAt: true },
      take: 5_000,
    });

    const warned = await this.warn(candidates, now);
    const expiredIds = await this.expire(candidates, now);
    const partnersForcedOffline = expiredIds.partnerIds.length ? await this.forceOffline(expiredIds.partnerIds, now) : 0;

    this.logger.info({ warned, expired: expiredIds.count, partnersForcedOffline }, 'partner document expiry sweep finished');
    return { warned, expired: expiredIds.count, partnersForcedOffline };
  }

  private async warn(candidates: ExpiringDocument[], now: Date): Promise<number> {
    const due = documentsToWarn(candidates, now);
    let sent = 0;
    for (const doc of due) {
      if (!doc.expiresAt) continue;
      // Claim the document first: the UPDATE is the lock, so a concurrent worker warns nobody twice.
      const claimed = await this.prisma.partnerDocument.updateMany({ where: { id: doc.id, expiryNotifiedAt: null }, data: { expiryNotifiedAt: now } });
      if (claimed.count === 0) continue;
      try {
        await this.notifications.notify({
          userId: doc.partnerId,
          event: NotificationEvent.DOCUMENT_EXPIRING,
          vars: { documentType: doc.type, expiresAt: doc.expiresAt.toISOString().slice(0, 10), days: String(daysUntil(doc.expiresAt, now)) },
          data: { documentId: doc.id, documentType: doc.type },
          priority: 'high',
        });
        sent += 1;
      } catch (err) {
        // Release the claim so the next sweep retries instead of silently dropping the warning.
        await this.prisma.partnerDocument.updateMany({ where: { id: doc.id }, data: { expiryNotifiedAt: null } });
        this.logger.error({ err, documentId: doc.id }, 'could not queue DOCUMENT_EXPIRING notification');
        throw err;
      }
    }
    return sent;
  }

  private async expire(candidates: ExpiringDocument[], now: Date): Promise<{ count: number; partnerIds: string[] }> {
    const lapsed = documentsToExpire(candidates, now);
    if (!lapsed.length) return { count: 0, partnerIds: [] };
    const result = await this.prisma.partnerDocument.updateMany({
      where: { id: { in: lapsed.map((d) => d.id) }, status: { notIn: [DocumentStatus.EXPIRED, DocumentStatus.REJECTED] } },
      data: { status: DocumentStatus.EXPIRED },
    });
    return { count: result.count, partnerIds: [...new Set(lapsed.map((d) => d.partnerId))] };
  }

  /**
   * A lapsed document only blocks work when the partner's categories actually require that
   * type — `PartnerAvailabilityService.expiredRequiredDocuments` owns that rule.
   */
  private async forceOffline(partnerIds: string[], now: Date): Promise<number> {
    const partners = await this.prisma.partnerProfile.findMany({
      where: { userId: { in: partnerIds } },
      select: {
        userId: true,
        categories: { select: { category: { select: { requiredDocumentTypes: true } } } },
        documents: { select: { type: true, status: true, expiresAt: true } },
        availability: { select: { status: true } },
      },
    });
    let forced = 0;
    for (const partner of partners) {
      const expired = PartnerAvailabilityService.expiredRequiredDocuments(partner, now);
      if (!expired.length) continue;
      if (!partner.availability || partner.availability.status === AvailabilityStatus.OFFLINE) continue;
      await this.prisma.partnerAvailability.update({ where: { partnerId: partner.userId }, data: { status: AvailabilityStatus.OFFLINE, onlineSince: null } });
      this.logger.warn({ partnerId: partner.userId, expired }, 'partner forced offline — required documents expired');
      forced += 1;
    }
    return forced;
  }
}
