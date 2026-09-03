import type { DocumentStatus, DocumentType } from '@tamam/shared-types';

/** Minimal shape of a partner document for the expiry rules — no Prisma, no I/O. */
export interface ExpiringDocument {
  id: string;
  partnerId: string;
  type: DocumentType;
  status: DocumentStatus;
  expiresAt: Date | null;
  expiryNotifiedAt: Date | null;
}

/** Documents are warned about this many days before they lapse (spec §160). */
export const DOCUMENT_EXPIRY_WARNING_DAYS = 14;

export const dayMs = 86_400_000;

/**
 * Documents that should trigger a DOCUMENT_EXPIRING notification: still valid, expiring inside
 * the warning window, and not warned about yet. Rejected/expired documents are skipped — their
 * owner already has a different message.
 */
export function documentsToWarn(documents: ExpiringDocument[], now: Date, warningDays = DOCUMENT_EXPIRY_WARNING_DAYS): ExpiringDocument[] {
  const horizon = now.getTime() + warningDays * dayMs;
  return documents.filter(
    (doc) =>
      doc.expiresAt !== null &&
      doc.expiryNotifiedAt === null &&
      (doc.status === 'PENDING' || doc.status === 'APPROVED') &&
      doc.expiresAt.getTime() >= now.getTime() &&
      doc.expiresAt.getTime() <= horizon,
  );
}

/** Documents whose expiry date has passed and that are not flagged EXPIRED yet. */
export function documentsToExpire(documents: ExpiringDocument[], now: Date): ExpiringDocument[] {
  return documents.filter((doc) => doc.expiresAt !== null && doc.expiresAt.getTime() < now.getTime() && doc.status !== 'EXPIRED' && doc.status !== 'REJECTED');
}

/** Whole days left before a document lapses (never negative) — used in the notification text. */
export function daysUntil(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs));
}
