import { ChaletBookingStatus } from '@tamam/shared-types';

import { type AuthContext, SEED, TestApp } from './helpers/app';
import { createChaletFixture } from './helpers/chalet';

/**
 * The owner's surface over HTTP.
 *
 * Ownership is the whole access rule here — there is no chalet-owner role, an
 * owner manages their chalet because it is theirs. So the test that matters
 * most is the one where somebody else asks for the same data.
 */
describe('Chalet owner dashboard (§81)', () => {
  let api: TestApp;
  let outsider: AuthContext;
  let chaletId: string;
  let ownerId: string;
  let ownerToken: string;

  const slotAt = (hourUtc: number, daysAhead = 3): string => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() + daysAhead);
    at.setUTCHours(hourUtc, 0, 0, 0);
    return at.toISOString();
  };

  beforeAll(async () => {
    api = await TestApp.boot();
    outsider = await api.loginCustomer(SEED.customerPhone);

    ({ chaletId, ownerId } = await createChaletFixture(api.prisma));
    // The fixture's owner is a real user row; give them a session the same way
    // the app would, so the ownership check runs against a genuine token.
    const owner = await api.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { phone: true },
    });
    const session = await api.loginCustomer(owner.phone, 'e2e-owner-device');
    ownerToken = session.accessToken;
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.prisma.chaletBooking.deleteMany({ where: { chaletId } });
  });

  const asOwner = (path: string) =>
    api.request().get(api.url(path)).set('Authorization', `Bearer ${ownerToken}`);

  it('lists the chalets this owner has', async () => {
    const res = await asOwner('owner/chalets').expect(200);
    expect(res.body.some((c: { id: string }) => c.id === chaletId)).toBe(true);
    const found = res.body.find((c: { id: string }) => c.id === chaletId);
    expect(found.approvalStatus).toBe('APPROVED');
    expect(typeof found.baseHourlyRate.amount).toBe('number');
  });

  it('does not list somebody else’s chalets', async () => {
    const res = await api
      .request()
      .get(api.url('owner/chalets'))
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(200);
    expect(res.body.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('keeps an outsider out of the calendar', async () => {
    await api
      .request()
      .get(api.url(`owner/chalets/${chaletId}/calendar`))
      .query({ date: slotAt(9).slice(0, 10) })
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403);
  });

  it('keeps an outsider out of the occupancy report', async () => {
    await api
      .request()
      .get(api.url(`owner/chalets/${chaletId}/occupancy`))
      .query({ date: slotAt(9).slice(0, 10) })
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403);
  });

  it('serves the calendar for a day', async () => {
    const res = await asOwner(`owner/chalets/${chaletId}/calendar`)
      .query({ date: slotAt(9).slice(0, 10) })
      .expect(200);
    expect(res.body.chaletId).toBe(chaletId);
    expect(Array.isArray(res.body.windows)).toBe(true);
  });

  it('reports occupancy with the weekday and hour breakdowns', async () => {
    const res = await asOwner(`owner/chalets/${chaletId}/occupancy`)
      .query({ date: slotAt(9).slice(0, 10) })
      .expect(200);

    expect(res.body.byDayOfWeek).toHaveLength(7);
    expect(res.body.byHourOfDay).toHaveLength(24);
    expect(typeof res.body.occupancyPercent).toBe('number');
    expect(res.body.revenue.currency).toBe('ILS');
  });

  it('records a booking taken over the phone, and lists it beside the rest', async () => {
    await api
      .request()
      .post(api.url(`owner/chalets/${chaletId}/bookings/external`))
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        startAt: slotAt(9),
        endAt: slotAt(13),
        guestCount: 4,
        guestName: 'أبو محمد',
        guestPhone: '+970599111222',
      })
      .expect(201);

    const list = await asOwner(`owner/chalets/${chaletId}/bookings`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].source).toBe('OWNER_MANUAL');
    expect(list.body[0].guestName).toBe('أبو محمد');
    expect(list.body[0].status).toBe(ChaletBookingStatus.CONFIRMED);
  });

  it('does not let an outsider record a booking on the chalet', async () => {
    await api
      .request()
      .post(api.url(`owner/chalets/${chaletId}/bookings/external`))
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      // A valid body on purpose: an invalid one would be refused by validation
      // before the ownership check ran, and prove nothing about authorisation.
      .send({ startAt: slotAt(9), endAt: slotAt(13), guestCount: 4, guestName: 'أبو أحمد' })
      .expect(403);
  });

  it('shows the gaps between bookings', async () => {
    await api
      .request()
      .post(api.url(`owner/chalets/${chaletId}/bookings/external`))
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ startAt: slotAt(6), endAt: slotAt(8), guestCount: 2, guestName: 'ضيف الصباح' })
      .expect(201);
    await api
      .request()
      .post(api.url(`owner/chalets/${chaletId}/bookings/external`))
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ startAt: slotAt(14, 3), endAt: slotAt(18), guestCount: 2, guestName: 'ضيف المساء' })
      .expect(201);

    const res = await asOwner(`owner/chalets/${chaletId}/gaps`)
      .query({ date: slotAt(9).slice(0, 10) })
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].isGap).toBe(true);
  });

  it('flips an automation switch without touching anything else', async () => {
    const res = await api
      .request()
      .patch(api.url(`owner/chalets/${chaletId}/automation`))
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ smartPricingEnabled: true })
      .expect(200);

    expect(res.body.smartPricingEnabled).toBe(true);
    // Nothing else moved: the switches are independent by design.
    expect(res.body.gapFillerEnabled).toBe(false);

    await api
      .request()
      .patch(api.url(`owner/chalets/${chaletId}/automation`))
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ smartPricingEnabled: false })
      .expect(200);
  });

  it('does not let an outsider flip the switches', async () => {
    await api
      .request()
      .patch(api.url(`owner/chalets/${chaletId}/automation`))
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ smartPricingEnabled: true })
      .expect(403);
  });
});
