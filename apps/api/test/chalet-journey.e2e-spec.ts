import { ChaletBookingStatus } from '@tamam/shared-types';

import { type AuthContext, SEED, TestApp } from './helpers/app';
import { createChaletFixture } from './helpers/chalet';

/**
 * Spec §80/§85 — the customer's journey over HTTP.
 *
 * The unit tests cover the rules; this covers the wiring. A route that is
 * registered but unreachable, a decorator that silently disables validation, a
 * DTO that serialises BigInt as a string — none of those show up in a unit test
 * and all of them break the app.
 */
describe('Chalet customer journey (§80)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let chaletId: string;

  /**
   * A slot `daysAhead` from now at a fixed UTC hour. The offset is explicit
   * because the refund policy turns on distance from now: two days out
   * straddles the 48-hour free-cancellation boundary depending on what time
   * the suite happens to run, which would make the test flaky rather than
   * wrong.
   */
  const slotAt = (hourUtc: number, minute = 0, daysAhead = 2): string => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() + daysAhead);
    at.setUTCHours(hourUtc, minute, 0, 0);
    return at.toISOString();
  };

  const dateOfSlot = (): string => slotAt(9).slice(0, 10);

  beforeAll(async () => {
    api = await TestApp.boot();
    customer = await api.loginCustomer(SEED.customerPhone);
    ({ chaletId } = await createChaletFixture(api.prisma));
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.prisma.chaletBooking.deleteMany({ where: { chaletId } });
  });

  it('shows availability without asking the customer to sign in', async () => {
    const res = await api
      .request()
      .get(api.url(`chalets/${chaletId}/availability`))
      .query({ date: dateOfSlot() })
      .expect(200);

    expect(res.body.chaletId).toBe(chaletId);
    expect(res.body.bookingIntervalMinutes).toBe(15);
    expect(res.body.cleaningDurationMinutes).toBe(90);
    expect(Array.isArray(res.body.windows)).toBe(true);
    expect(res.body.suggestedStartTimes.length).toBeGreaterThan(0);
  });

  it('rejects a malformed date rather than guessing', async () => {
    await api
      .request()
      .get(api.url(`chalets/${chaletId}/availability`))
      .query({ date: 'tomorrow' })
      .expect(422);
  });

  it('prices a free slot and renders money as numbers', async () => {
    const res = await api
      .request()
      .get(api.url(`chalets/${chaletId}/slot-check`))
      .query({ startAt: slotAt(9), endAt: slotAt(13) })
      .expect(200);

    expect(res.body.available).toBe(true);
    expect(res.body.reason).toBe('FREE');
    expect(typeof res.body.price.total.amount).toBe('number');
    expect(res.body.price.total.currency).toBe('ILS');
    expect(res.body.price.durationMinutes).toBe(240);
  });

  /** Hold then confirm, returning the booking body. */
  async function bookSlot(daysAhead: number) {
    const held = await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        chaletId,
        startAt: slotAt(9, 0, daysAhead),
        endAt: slotAt(13, 0, daysAhead),
        guestCount: 4,
      })
      .expect(201);

    const confirmed = await api
      .request()
      .post(api.url(`chalets/bookings/${held.body.id}/confirm`))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(201);
    return { held: held.body, confirmed: confirmed.body };
  }

  it('holds and confirms a booking', async () => {
    const { held, confirmed } = await bookSlot(2);

    expect(held.status).toBe(ChaletBookingStatus.HELD);
    expect(held.bookingNumber).toMatch(/^CH-\d{4}-\d{6}$/);
    expect(held.holdExpiresAt).not.toBeNull();
    // Money crosses the wire as a number inside the breakdown, not as a
    // BigInt string and not as a bare column on the row.
    expect(typeof held.price.total.amount).toBe('number');
    expect(held.price.total.currency).toBe('ILS');
    // The row's internal columns stay internal.
    expect(held.pricingSnapshot).toBeUndefined();
    expect(held.version).toBeUndefined();
    expect(confirmed.status).toBe(ChaletBookingStatus.CONFIRMED);
    expect(confirmed.holdExpiresAt).toBeNull();
  });

  it('refunds in full when cancelled well outside the free-cancellation window', async () => {
    // Five days out is unambiguously beyond the default 48 hours.
    const { held } = await bookSlot(5);

    const cancelled = await api
      .request()
      .post(api.url(`chalets/bookings/${held.id}/cancel`))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ reason: 'تغيّرت خططنا' })
      .expect(201);

    expect(cancelled.body.booking.status).toBe(ChaletBookingStatus.CANCELLED);
    expect(cancelled.body.refundPercent).toBe(100);
  });

  it('refunds partially when cancelled inside it', async () => {
    // Tomorrow is always inside 48 hours, whatever time the suite runs.
    const { held } = await bookSlot(1);

    const cancelled = await api
      .request()
      .post(api.url(`chalets/bookings/${held.id}/cancel`))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ reason: 'late' })
      .expect(201);

    expect(cancelled.body.refundPercent).toBe(50);
  });

  it('frees the slot again once cancelled', async () => {
    const { held } = await bookSlot(2);
    await api
      .request()
      .post(api.url(`chalets/bookings/${held.id}/cancel`))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ reason: 'x' })
      .expect(201);

    const res = await api
      .request()
      .get(api.url(`chalets/${chaletId}/slot-check`))
      .query({ startAt: slotAt(9), endAt: slotAt(13) })
      .expect(200);
    expect(res.body.available).toBe(true);
  });

  it('refuses to hold a slot the cleaning window still covers', async () => {
    await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 })
      .expect(201);

    const refused = await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ chaletId, startAt: slotAt(13), endAt: slotAt(16), guestCount: 4 })
      .expect(409);

    expect(refused.body.code).toBe('CONFLICT');
    expect(refused.body.requestId).toBeDefined();
  });

  it('shows the cleaning window as occupied in availability too', async () => {
    await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 })
      .expect(201);

    const res = await api
      .request()
      .get(api.url(`chalets/${chaletId}/slot-check`))
      .query({ startAt: slotAt(13), endAt: slotAt(16) })
      .expect(200);

    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('OVERLAPS_BOOKING');
    expect(res.body.alternatives.length).toBeGreaterThan(0);
  });

  it('validates the body rather than accepting anything', async () => {
    await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      // Seconds on a booking instant are rejected, not truncated.
      .send({ chaletId, startAt: slotAt(9).replace(':00.000Z', ':30.000Z'), endAt: slotAt(13), guestCount: 4 })
      .expect(422);

    await api
      .request()
      .post(api.url('chalets/bookings'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 0 })
      .expect(422);
  });

  it('does not let an anonymous caller book', async () => {
    await api
      .request()
      .post(api.url('chalets/bookings'))
      .send({ chaletId, startAt: slotAt(9), endAt: slotAt(13), guestCount: 4 })
      .expect(401);
  });

  it('lists offers on a chalet without authentication', async () => {
    const res = await api.request().get(api.url(`chalets/${chaletId}/offers`)).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
