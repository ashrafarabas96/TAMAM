import { ChaletBookingStatus } from '@tamam/shared-types';

import {
  CANCELLABLE_BY_CUSTOMER,
  CHALET_TRANSITIONS,
  DEFAULT_CANCELLATION_POLICY,
  EXTENDABLE,
  canTransition,
  isExternal,
  refundPercentFor,
} from './booking-state';

describe('the chalet booking lifecycle', () => {
  it('covers every status', () => {
    const declared = Object.keys(CHALET_TRANSITIONS).sort();
    expect(declared).toEqual(Object.values(ChaletBookingStatus).sort());
  });

  it('only ever points at statuses that exist', () => {
    for (const targets of Object.values(CHALET_TRANSITIONS)) {
      for (const target of targets) {
        expect(Object.values(ChaletBookingStatus)).toContain(target);
      }
    }
  });

  it('walks the ordinary path from hold to completed', () => {
    const path = [
      ChaletBookingStatus.HELD,
      ChaletBookingStatus.CONFIRMED,
      ChaletBookingStatus.CHECK_IN_READY,
      ChaletBookingStatus.CHECKED_IN,
      ChaletBookingStatus.IN_PROGRESS,
      ChaletBookingStatus.CHECKED_OUT,
      ChaletBookingStatus.CLEANING,
      ChaletBookingStatus.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      if (from === undefined || to === undefined) throw new Error('bad path');
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('lets a cancelled or expired booking go nowhere', () => {
    expect(CHALET_TRANSITIONS.CANCELLED).toEqual([]);
    expect(CHALET_TRANSITIONS.EXPIRED).toEqual([]);
  });

  it('refuses to resurrect a cancelled booking', () => {
    expect(canTransition(ChaletBookingStatus.CANCELLED, ChaletBookingStatus.CONFIRMED)).toBe(false);
  });

  it('refuses to confirm a booking that never held a slot', () => {
    expect(canTransition(ChaletBookingStatus.DRAFT, ChaletBookingStatus.CONFIRMED)).toBe(false);
  });

  it('refuses to check in before confirming', () => {
    expect(canTransition(ChaletBookingStatus.HELD, ChaletBookingStatus.CHECKED_IN)).toBe(false);
  });

  it('keeps the booking open through cleaning rather than completing at checkout', () => {
    expect(canTransition(ChaletBookingStatus.CHECKED_OUT, ChaletBookingStatus.CLEANING)).toBe(true);
  });
});

describe('who may cancel and when', () => {
  it('lets a customer cancel anything that has not started', () => {
    expect(CANCELLABLE_BY_CUSTOMER).toContain(ChaletBookingStatus.CONFIRMED);
    expect(CANCELLABLE_BY_CUSTOMER).toContain(ChaletBookingStatus.HELD);
  });

  it('does not let a booking be cancelled once the guest is inside', () => {
    expect(CANCELLABLE_BY_CUSTOMER).not.toContain(ChaletBookingStatus.CHECKED_IN);
    expect(CANCELLABLE_BY_CUSTOMER).not.toContain(ChaletBookingStatus.IN_PROGRESS);
  });

  it('only allows extending a booking the guest is actually in', () => {
    expect(EXTENDABLE).toContain(ChaletBookingStatus.IN_PROGRESS);
    expect(EXTENDABLE).not.toContain(ChaletBookingStatus.HELD);
    expect(EXTENDABLE).not.toContain(ChaletBookingStatus.COMPLETED);
  });
});

describe('refundPercentFor', () => {
  const policy = DEFAULT_CANCELLATION_POLICY;

  it('refunds in full outside the free-cancellation window', () => {
    expect(refundPercentFor(policy, 72 * 60)).toBe(100);
  });

  it('refunds in full exactly on the boundary', () => {
    expect(refundPercentFor(policy, policy.freeCancellationHours * 60)).toBe(100);
  });

  it('refunds partially inside the window', () => {
    expect(refundPercentFor(policy, 10 * 60)).toBe(policy.refundPercentAfterWindow);
  });

  it('refunds nothing once the booking has started', () => {
    expect(refundPercentFor(policy, 0)).toBe(0);
    expect(refundPercentFor(policy, -60)).toBe(0);
  });

  it('honours a chalet’s own stricter policy', () => {
    const strict = { freeCancellationHours: 168, refundPercentAfterWindow: 0 };
    expect(refundPercentFor(strict, 72 * 60)).toBe(0);
    expect(refundPercentFor(strict, 200 * 60)).toBe(100);
  });
});

describe('isExternal', () => {
  it('treats an owner-recorded booking as external', () => {
    expect(isExternal('OWNER_MANUAL')).toBe(true);
    expect(isExternal('ADMIN')).toBe(true);
    expect(isExternal('TAMAM')).toBe(false);
  });
});
