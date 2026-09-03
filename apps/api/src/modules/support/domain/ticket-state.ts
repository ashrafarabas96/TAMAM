import { ErrorCode, TicketCategory, TicketPriority, TicketStatus } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';

/**
 * Pure support rules (spec §63). No Nest, no Prisma: the ticket state machine, the priority
 * policy and the report → category mapping are deterministic and unit-tested on their own.
 */

/** Allowed agent-driven status moves. Reopening a resolved ticket is deliberate, closing is final. */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.WAITING_USER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.WAITING_USER]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.RESOLVED]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

/** Statuses that still need somebody to act on them (dashboard "open tickets" counter). */
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER];

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || (TICKET_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTicketTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransitionTicket(from, to)) {
    throw AppException.conflict(`A ticket cannot move from ${from} to ${to}`, ErrorCode.INVALID_STATE_TRANSITION, { from, to });
  }
}

/** Safety issues jump the queue; everything else starts at the requested (or default) priority. */
export function priorityFor(category: TicketCategory, requested?: TicketPriority): TicketPriority {
  if (requested) return requested;
  return category === TicketCategory.SAFETY ? TicketPriority.HIGH : TicketPriority.NORMAL;
}

/** Report reasons that always mean a safety escalation rather than a behaviour complaint. */
export const SAFETY_REPORT_REASONS: readonly string[] = ['UNSAFE_DRIVING', 'HARASSMENT'];

export interface ReportRouting {
  category: TicketCategory;
  priority: TicketPriority;
}

/**
 * Where a user report lands: unsafe driving and harassment become CRITICAL safety tickets,
 * anything else becomes a behaviour ticket about the reported party.
 */
export function routeReport(reason: string, reportedIsPartner: boolean): ReportRouting {
  if (SAFETY_REPORT_REASONS.includes(reason)) {
    return { category: TicketCategory.SAFETY, priority: TicketPriority.CRITICAL };
  }
  return {
    category: reportedIsPartner ? TicketCategory.PARTNER_BEHAVIOUR : TicketCategory.CUSTOMER_BEHAVIOUR,
    priority: TicketPriority.HIGH,
  };
}

/** `TK-YYMM-NNNNNN` (spec §63) — same shape as job and receipt numbers. */
export function ticketNumber(sequence: bigint, at: Date): string {
  const year = String(at.getUTCFullYear()).slice(2);
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `TK-${year}${month}-${String(sequence).padStart(6, '0')}`;
}
