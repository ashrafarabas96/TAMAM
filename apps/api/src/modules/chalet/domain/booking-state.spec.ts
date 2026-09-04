import { ChaletBookingStatus } from '@tamam/shared-types';

import {
  CANCELLABLE_BY_CUSTOMER,
  CHALET_TRANSITIONS,
  DEFAULT_CANCELLATION_POLICY,
  EXTENDABLE,
  canTransition,
  isExternal,
  overstayCharge,
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

describe('overstayCharge', () => {
  const hourly = 10_000n; // 100.00 an hour

  it('charges nothing inside the grace period', () => {
    expect(overstayCharge(10, hourly)).toEqual({ billedMinutes: 0, feeMinor: 0n });
    expect(overstayCharge(15, hourly)).toEqual({ billedMinutes: 0, feeMinor: 0n });
  });

  it('charges nothing for a guest who left on time or early', () => {
    expect(overstayCharge(0, hourly).feeMinor).toBe(0n);
  });

  it('bills in whole blocks once the grace runs out', () => {
    // 20 minutes late rounds up to one 30-minute block.
    expect(overstayCharge(20, hourly).billedMinutes).toBe(30);
    expect(overstayCharge(31, hourly).billedMinutes).toBe(60);
  });

  it('charges the premium rate, not the ordinary one', () => {
    // Half an hour at 150% of 100.00 an hour is 75.00.
    expect(overstayCharge(20, hourly).feeMinor).toBe(7_500n);
  });

  it('scales with how late the guest is', () => {
    const short = overstayCharge(20, hourly).feeMinor;
    const long = overstayCharge(90, hourly).feeMinor;
    expect(long).toBeGreaterThan(short);
  });

  it('bills the whole overrun once grace is exceeded, not just the excess', () => {
    // 16 minutes late is one 30-minute block, the same as 30 minutes late.
    // Billing only the minute past grace would make a long overstay cost
    // barely more than a brief one, and the chalet was occupied for all of it.
    expect(overstayCharge(16, hourly).billedMinutes).toBe(30);
    expect(overstayCharge(30, hourly).billedMinutes).toBe(30);
    expect(overstayCharge(31, hourly).billedMinutes).toBe(60);
  });

  it('follows a chalet’s own gentler policy', () => {
    const gentle = { graceMinutes: 60, surchargeMultiplier: 1, billingBlockMinutes: 60 };
    expect(overstayCharge(45, hourly, gentle).feeMinor).toBe(0n);
    // 70 minutes late is two whole-hour blocks at the ordinary rate.
    expect(overstayCharge(70, hourly, gentle).feeMinor).toBe(20_000n);
  });
});
