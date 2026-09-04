import { TestApp } from './helpers/app';
import { createChaletFixture } from './helpers/chalet';

/**
 * Chalet search over HTTP.
 *
 * Two things here are only findable at this level: whether the filters reach
 * the query at all (every parameter arrives as a string), and whether the
 * routes shadow each other — `GET /chalets/:id` sitting in front of
 * `GET /chalets/:id/availability` would make the second unreachable, and
 * nothing but a request would say so.
 */
describe('Chalet search', () => {
  let api: TestApp;
  let chaletId: string;
  let zoneId: string;

  const slotAt = (hourUtc: number, daysAhead = 3): string => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() + daysAhead);
    at.setUTCHours(hourUtc, 0, 0, 0);
    return at.toISOString();
  };

  beforeAll(async () => {
    api = await TestApp.boot();
    ({ chaletId } = await createChaletFixture(api.prisma));
    const chalet = await api.prisma.chalet.findUniqueOrThrow({
      where: { id: chaletId },
      select: { serviceZoneId: true },
    });
    zoneId = chalet.serviceZoneId;
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.prisma.chaletBooking.deleteMany({ where: { chaletId } });
  });

  it('lists visible chalets without authentication', async () => {
    const res = await api.request().get(api.url('chalets')).expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('renders money as numbers and location as a point', async () => {
    const res = await api.request().get(api.url('chalets')).expect(200);
    const found = res.body.items.find((c: { id: string }) => c.id === chaletId);
    expect(typeof found.baseHourlyRate.amount).toBe('number');
    expect(found.baseHourlyRate.currency).toBe('ILS');
    expect(typeof found.location.lat).toBe('number');
  });

  it('filters by zone', async () => {
    const hit = await api.request().get(api.url('chalets')).query({ zoneId }).expect(200);
    expect(hit.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);

    const otherZone = await api.prisma.serviceZone.findFirst({
      where: { id: { not: zoneId } },
      select: { id: true },
    });
    if (otherZone !== null) {
      const miss = await api
        .request()
        .get(api.url('chalets'))
        .query({ zoneId: otherZone.id })
        .expect(200);
      expect(miss.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
    }
  });

  it('filters by capacity, coercing the number out of the query string', async () => {
    const fits = await api.request().get(api.url('chalets')).query({ guestCount: '10' }).expect(200);
    expect(fits.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);

    const tooMany = await api
      .request()
      .get(api.url('chalets'))
      .query({ guestCount: '100' })
      .expect(200);
    expect(tooMany.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('filters by price ceiling', async () => {
    const under = await api
      .request()
      .get(api.url('chalets'))
      .query({ maxHourlyRateMinor: '20000' })
      .expect(200);
    expect(under.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);

    const over = await api
      .request()
      .get(api.url('chalets'))
      .query({ maxHourlyRateMinor: '5000' })
      .expect(200);
    expect(over.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('narrows to chalets genuinely free in a window', async () => {
    const free = await api
      .request()
      .get(api.url('chalets'))
      .query({ startAt: slotAt(9), endAt: slotAt(13) })
      .expect(200);
    expect(free.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);

    // Book it, and it should drop out of the same search.
    await api.prisma.chaletBooking.create({
      data: {
        bookingNumber: `CH-SEARCH-${Date.now() % 100000}`,
        chaletId,
        startAt: new Date(slotAt(9)),
        endAt: new Date(slotAt(13)),
        blockedUntil: new Date(slotAt(13)),
        bookingDurationMinutes: 240,
        cleaningDurationMinutes: 90,
        guestCount: 4,
        basePriceMinor: 40_000n,
        totalAmountMinor: 40_000n,
        currency: 'ILS',
        pricingSnapshot: {},
        status: 'CONFIRMED',
      },
    });

    const taken = await api
      .request()
      .get(api.url('chalets'))
      .query({ startAt: slotAt(9), endAt: slotAt(13) })
      .expect(200);
    expect(taken.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('also excludes a window that only overlaps the cleaning buffer', async () => {
    await api.prisma.chaletBooking.create({
      data: {
        bookingNumber: `CH-CLEAN-${Date.now() % 100000}`,
        chaletId,
        startAt: new Date(slotAt(9)),
        endAt: new Date(slotAt(13)),
        blockedUntil: new Date(slotAt(13)),
        bookingDurationMinutes: 240,
        cleaningDurationMinutes: 90,
        guestCount: 4,
        basePriceMinor: 40_000n,
        totalAmountMinor: 40_000n,
        currency: 'ILS',
        pricingSnapshot: {},
        status: 'CONFIRMED',
      },
    });

    // 13:00 is inside the cleaning window that runs to 14:30.
    const res = await api
      .request()
      .get(api.url('chalets'))
      .query({ startAt: slotAt(13), endAt: slotAt(16) })
      .expect(200);
    expect(res.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('hides a chalet that is not approved', async () => {
    await api.prisma.chalet.update({
      where: { id: chaletId },
      data: { approvalStatus: 'PENDING' },
    });
    const res = await api.request().get(api.url('chalets')).expect(200);
    expect(res.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);

    await api.prisma.chalet.update({
      where: { id: chaletId },
      data: { approvalStatus: 'APPROVED' },
    });
  });

  it('serves one chalet in full', async () => {
    const res = await api.request().get(api.url(`chalets/${chaletId}`)).expect(200);
    expect(res.body.id).toBe(chaletId);
    expect(res.body.scheduling.bookingIntervalMinutes).toBe(15);
    expect(res.body.scheduling.defaultCleaningDurationMinutes).toBe(90);
    expect(res.body.pricing.minimumHourlyRate.amount).toBe(6_000);
    expect(Array.isArray(res.body.amenities)).toBe(true);
    expect(Array.isArray(res.body.media)).toBe(true);
  });

  it('does not shadow the deeper routes under the same prefix', async () => {
    // `GET /chalets/:id` is declared before these; if it matched greedily they
    // would be unreachable and nothing but a request would tell us.
    await api
      .request()
      .get(api.url(`chalets/${chaletId}/availability`))
      .query({ date: slotAt(9).slice(0, 10) })
      .expect(200);
    await api.request().get(api.url(`chalets/${chaletId}/offers`)).expect(200);
    await api
      .request()
      .get(api.url(`chalets/${chaletId}/slot-check`))
      .query({ startAt: slotAt(9), endAt: slotAt(13) })
      .expect(200);
  });

  it('reports an unknown chalet as not found rather than empty', async () => {
    await api
      .request()
      .get(api.url('chalets/11111111-1111-4111-8111-999999999999'))
      .expect(404);
  });

  it('rejects a malformed id rather than querying with it', async () => {
    await api.request().get(api.url('chalets/not-a-uuid')).expect(422);
  });
});
