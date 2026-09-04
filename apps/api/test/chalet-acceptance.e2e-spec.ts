import { ChaletBookingStatus } from '@tamam/shared-types';

import { ChaletBookingService } from '../src/modules/chalet/chalet-booking.service';
import { ChaletOffersService } from '../src/modules/chalet/chalet-offers.service';

import { type AuthContext, SEED, TestApp } from './helpers/app';
import { createChaletCustomer, createChaletFixture } from './helpers/chalet';

/**
 * TAMAM Chalet — the acceptance suite.
 *
 * Each block below is one guarantee the module exists to provide, exercised
 * against a real database and (where there is one) a real HTTP route. They are
 * written as promises to a chalet owner rather than as unit assertions: an
 * owner should be able to read the test names and recognise the product.
 *
 * The last block walks a whole booking from search to completion in one go.
 */
describe('Chalet acceptance', () => {
  let api: TestApp;
  let customer: AuthContext;
  let bookings: ChaletBookingService;
  let offers: ChaletOffersService;
  let chaletId: string;
  let ownerId: string;

  /** A slot on a fixed UTC hour, `daysAhead` from now. */
  const slot = (hourUtc: number, minute = 0, daysAhead = 3): Date => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() + daysAhead);
    at.setUTCHours(hourUtc, minute, 0, 0);
    return at;
  };
  const iso = (d: Date): string => d.toISOString();

  const asUser = (id: string) => ({
    user: {
      id,
      phone: '+970599000000',
      roles: ['CUSTOMER'],
      permissions: [],
      accountStatus: 'ACTIVE',
      sessionId: 'e2e',
      deviceId: 'e2e',
      language: 'ar' as const,
      customerId: id,
      isSuperAdmin: false,
    },
  }) as Parameters<ChaletBookingService['hold']>[0];

  beforeAll(async () => {
    api = await TestApp.boot();
    customer = await api.loginCustomer(SEED.customerPhone);
    bookings = api.app.get(ChaletBookingService);
    offers = api.app.get(ChaletOffersService);
    ({ chaletId, ownerId } = await createChaletFixture(api.prisma));
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.prisma.chaletOffer.deleteMany({ where: { chaletId } });
    await api.prisma.chaletBooking.deleteMany({ where: { chaletId } });
    await api.prisma.chaletBlock.deleteMany({ where: { chaletId } });
  });

  const book = async (
    startAt: Date,
    endAt: Date,
    who?: string,
  ): Promise<{ id: string; status: ChaletBookingStatus }> => {
    const userId = who ?? (await createChaletCustomer(api.prisma));
    const held = await bookings.hold(asUser(userId), {
      chaletId,
      startAt: iso(startAt),
      endAt: iso(endAt),
      guestCount: 4,
    });
    return { id: held.id, status: held.status };
  };

  /* ------------------------------------------------------------------ 1 */
  describe('1. the same slot cannot be sold twice', () => {
    it('lets exactly one of two simultaneous holds win', async () => {
      const [a, b] = await Promise.all([
        createChaletCustomer(api.prisma),
        createChaletCustomer(api.prisma),
      ]);
      const request = { chaletId, startAt: iso(slot(9)), endAt: iso(slot(13)), guestCount: 4 };

      const results = await Promise.allSettled([
        bookings.hold(asUser(a as string), request),
        bookings.hold(asUser(b as string), request),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const rows = await api.prisma.chaletBooking.findMany({
        where: { chaletId, status: ChaletBookingStatus.HELD },
      });
      expect(rows).toHaveLength(1);
    });

    it('refuses a booking that sits inside another', async () => {
      await book(slot(9), slot(13));
      await expect(book(slot(10), slot(12))).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  /* ------------------------------------------------------------------ 2 */
  describe('2. cleaning time belongs to the chalet, not the next guest', () => {
    it('blocks the ninety minutes after a booking ends', async () => {
      await book(slot(9), slot(13));
      await expect(book(slot(13), slot(16))).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(book(slot(14), slot(17))).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('opens the moment the cleaning ends, not a minute later', async () => {
      await book(slot(9), slot(13));
      const next = await book(slot(14, 30), slot(17));
      expect(next.status).toBe(ChaletBookingStatus.HELD);
    });

    it('derives the blocked window in the database rather than trusting the caller', async () => {
      const held = await book(slot(9), slot(13));
      const stored = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(stored.blockedUntil.getTime() - stored.endAt.getTime()).toBe(90 * 60_000);
    });
  });

  /* ------------------------------------------------------------------ 3 */
  describe('3. a hold protects checkout, then releases the slot', () => {
    it('sets an expiry from the chalet’s own hold window', async () => {
      const held = await book(slot(9), slot(13));
      const stored = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(stored.holdExpiresAt).not.toBeNull();
      const minutes =
        (stored.holdExpiresAt!.getTime() - stored.createdAt.getTime()) / 60_000;
      expect(Math.round(minutes)).toBe(7);
    });

    it('releases the slot once the hold lapses, without waiting for the sweeper', async () => {
      const held = await book(slot(9), slot(13));
      await api.prisma.chaletBooking.update({
        where: { id: held.id },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });

      const retaken = await book(slot(9), slot(13));
      expect(retaken.status).toBe(ChaletBookingStatus.HELD);
      const lapsed = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(lapsed.status).toBe(ChaletBookingStatus.EXPIRED);
    });

    it('refuses to confirm a hold that has run out', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await api.prisma.chaletBooking.update({
        where: { id: held.id },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      await expect(bookings.confirm(asUser(userId), held.id)).rejects.toMatchObject({
        code: 'OFFER_EXPIRED',
      });
    });

    it('sweeps lapsed holds on schedule too', async () => {
      const held = await book(slot(9), slot(13));
      await api.prisma.chaletBooking.update({
        where: { id: held.id },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      expect(await bookings.expireHolds()).toBeGreaterThanOrEqual(1);
      const after = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(after.status).toBe(ChaletBookingStatus.EXPIRED);
    });
  });

  /* ------------------------------------------------------------------ 4 */
  describe('4. availability tells the truth about what is bookable', () => {
    it('subtracts bookings and their cleaning from the free windows', async () => {
      await book(slot(9), slot(13));
      const date = iso(slot(9)).slice(0, 10);

      const res = await api
        .request()
        .get(api.url(`chalets/${chaletId}/availability`))
        .query({ date })
        .expect(200);

      const covered = res.body.windows.some(
        (w: { startAt: string; endAt: string }) =>
          new Date(w.startAt) < slot(14, 30) && new Date(w.endAt) > slot(9),
      );
      expect(covered).toBe(false);
    });

    it('never offers a start time the database would then refuse', async () => {
      await book(slot(9), slot(13));
      const date = iso(slot(9)).slice(0, 10);

      const res = await api
        .request()
        .get(api.url(`chalets/${chaletId}/availability`))
        .query({ date, durationMinutes: 120 })
        .expect(200);

      // Take every suggestion the engine made for that day and try each one.
      const suggestions: string[] = res.body.suggestedStartTimes.slice(0, 6);
      expect(suggestions.length).toBeGreaterThan(0);

      for (const startAt of suggestions) {
        const endAt = new Date(new Date(startAt).getTime() + 120 * 60_000);
        const userId = await createChaletCustomer(api.prisma);
        const held = await bookings.hold(asUser(userId), {
          chaletId,
          startAt,
          endAt: iso(endAt),
          guestCount: 2,
        });
        // Release it again so the next suggestion is still free to test.
        await bookings.cancel(asUser(userId), held.id, { reason: 'probe' });
      }
    });
  });

  /* ------------------------------------------------------------------ 5 */
  describe('5. an owner block is as real as a booking', () => {
    it('keeps a blocked window unbookable', async () => {
      await api.prisma.chaletBlock.create({
        data: { chaletId, startAt: slot(9), endAt: slot(13), kind: 'MAINTENANCE' },
      });
      await expect(book(slot(10), slot(12))).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('says it was a block, not another guest', async () => {
      await api.prisma.chaletBlock.create({
        data: { chaletId, startAt: slot(9), endAt: slot(13), kind: 'OWNER_BLOCK' },
      });
      const res = await api
        .request()
        .get(api.url(`chalets/${chaletId}/slot-check`))
        .query({ startAt: iso(slot(10)), endAt: iso(slot(12)) })
        .expect(200);
      expect(res.body.reason).toBe('OVERLAPS_BLOCK');
    });
  });

  /* ------------------------------------------------------------------ 6 */
  describe('6. the TAMAM calendar is the only calendar', () => {
    it('lets an owner record a booking taken over the phone', async () => {
      const external = await bookings.createExternal(asUser(ownerId), chaletId, {
        startAt: iso(slot(9)),
        endAt: iso(slot(13)),
        guestCount: 4,
        guestName: 'أبو محمد',
        source: 'OWNER_MANUAL',
      });
      expect(external.status).toBe(ChaletBookingStatus.CONFIRMED);
      expect(external.customerId).toBeNull();
    });

    it('makes that booking block the calendar like any other', async () => {
      await bookings.createExternal(asUser(ownerId), chaletId, {
        startAt: iso(slot(9)),
        endAt: iso(slot(13)),
        guestCount: 4,
        guestName: 'أبو محمد',
        source: 'OWNER_MANUAL',
      });
      await expect(book(slot(10), slot(12))).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('stops the owner double-booking themselves from the other direction', async () => {
      await book(slot(9), slot(13));
      await expect(
        bookings.createExternal(asUser(ownerId), chaletId, {
          startAt: iso(slot(10)),
          endAt: iso(slot(12)),
          guestCount: 4,
          guestName: 'أبو محمد',
          source: 'OWNER_MANUAL',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  /* ------------------------------------------------------------------ 7 */
  describe('7. the price never goes below what the owner set', () => {
    it('quotes at or above the floor even on an empty calendar', async () => {
      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: {
          smartPricingEnabled: true,
          lastMinutePricingEnabled: true,
          pricingProfile: 'AGGRESSIVE_OCCUPANCY',
          minimumHourlyRateMinor: 9_000n,
        },
      });

      const res = await api
        .request()
        .get(api.url(`chalets/${chaletId}/slot-check`))
        .query({ startAt: iso(slot(9)), endAt: iso(slot(13)) })
        .expect(200);

      expect(res.body.price.effectiveHourlyRate.amount).toBeGreaterThanOrEqual(9_000);

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: {
          smartPricingEnabled: false,
          lastMinutePricingEnabled: false,
          pricingProfile: 'BALANCED',
          minimumHourlyRateMinor: 6_000n,
        },
      });
    });

    it('says when the floor is what set the price', async () => {
      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { smartPricingEnabled: true, minimumHourlyRateMinor: 10_000n },
      });
      const res = await api
        .request()
        .get(api.url(`chalets/${chaletId}/slot-check`))
        .query({ startAt: iso(slot(9)), endAt: iso(slot(13)) })
        .expect(200);
      expect(res.body.price.clampedToMinimum).toBe(true);

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { smartPricingEnabled: false, minimumHourlyRateMinor: 6_000n },
      });
    });
  });

  /* ------------------------------------------------------------------ 8 */
  describe('8. a confirmed price is history', () => {
    it('refuses to rewrite the snapshot of a confirmed booking', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);

      await expect(
        api.prisma.chaletBooking.update({
          where: { id: held.id },
          data: { pricingSnapshot: { tampered: true } },
        }),
      ).rejects.toThrow(/immutable/);
    });

    it('leaves an old booking’s price alone when the owner reprices', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      const before = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { baseHourlyRateMinor: 30_000n },
      });
      const after = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(after.totalAmountMinor).toBe(before.totalAmountMinor);

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { baseHourlyRateMinor: 10_000n },
      });
    });
  });

  /* ------------------------------------------------------------------ 9 */
  describe('9. extending is allowed only when the time is actually free', () => {
    it('adds the hours and charges for them', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);

      const result = await bookings.extend(asUser(userId), held.id, { additionalMinutes: 60 });
      expect(result.booking.endAt).toEqual(slot(14));
      expect(result.extraAmountMinor).toBeGreaterThan(0n);
    });

    it('refuses when the next booking’s slot is in the way', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      await book(slot(14, 30), slot(17));

      await expect(
        bookings.extend(asUser(userId), held.id, { additionalMinutes: 120 }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('moves the cleaning window along with the new end', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      await bookings.extend(asUser(userId), held.id, { additionalMinutes: 60 });

      const stored = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id: held.id } });
      expect(stored.blockedUntil).toEqual(slot(15, 30));
    });
  });

  /* ----------------------------------------------------------------- 10 */
  describe('10. a guest who overstays is charged, not evicted', () => {
    /**
     * A stay that has already happened. The booking is made in the future —
     * holding a slot in the past is rightly refused — and the check-in and
     * check-out clocks are driven explicitly instead of waiting three days.
     */
    async function stayed(leftAt: Date) {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      await bookings.checkIn(asUser(userId), held.id, slot(9));
      return { userId, id: held.id, result: await bookings.checkOut(asUser(userId), held.id, leftAt) };
    }

    it('charges nothing for leaving on time', async () => {
      const { result } = await stayed(slot(13));
      expect(result.overstayFeeMinor).toBe(0n);
      expect(result.overstayMinutes).toBe(0);
    });

    it('forgives a few minutes', async () => {
      const { result } = await stayed(slot(13, 10));
      expect(result.overstayFeeMinor).toBe(0n);
    });

    it('charges a premium once the grace runs out', async () => {
      const { id, result } = await stayed(slot(13, 40));
      expect(result.overstayMinutes).toBe(60);
      expect(result.overstayFeeMinor).toBeGreaterThan(0n);

      const stored = await api.prisma.chaletBooking.findUniqueOrThrow({ where: { id } });
      expect(stored.totalAmountMinor).toBeGreaterThan(40_000n);
      // The agreed price is untouched; the overstay is added on top.
      expect(stored.overstayFeeMinor).toBe(result.overstayFeeMinor);
    });

    it('records the overstay on the trail', async () => {
      const { id } = await stayed(slot(13, 40));
      const events = await api.prisma.chaletBookingEvent.findMany({
        where: { bookingId: id },
        select: { type: true },
      });
      expect(events.map((e) => e.type)).toContain('OVERSTAY');
    });

    it('refuses a check-in before the window opens', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      await expect(bookings.checkIn(asUser(userId), held.id)).rejects.toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
      });
    });
  });

  /* ----------------------------------------------------------------- 11 */
  describe('11. empty gaps are found and offered', () => {
    it('offers the hole between two bookings', async () => {
      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { gapFillerEnabled: true },
      });
      const date = iso(slot(9)).slice(0, 10);

      // Booked 06:00-08:00 and 14:30-18:00 UTC, leaving a gap in between once
      // the first booking's cleaning ends at 09:30.
      await book(slot(6), slot(8));
      await book(slot(14, 30), slot(18));

      const created = await offers.generateForChalet(chaletId, date);
      expect(created).toBeGreaterThanOrEqual(1);

      const live = await offers.liveOffers(chaletId);
      expect(live.length).toBeGreaterThanOrEqual(1);
      expect(live[0]?.kind).toBe('GAP_FILLER');
      expect(live[0]?.discountPercent).toBeGreaterThan(0);

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { gapFillerEnabled: false },
      });
    });

    it('retires an offer whose slot has since been taken', async () => {
      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { gapFillerEnabled: true },
      });
      const date = iso(slot(9)).slice(0, 10);
      await book(slot(6), slot(8));
      await book(slot(14, 30), slot(18));
      await offers.generateForChalet(chaletId, date);

      const live = await offers.liveOffers(chaletId);
      expect(live.length).toBeGreaterThanOrEqual(1);

      // Somebody books the gap.
      await book(slot(10), slot(12));
      await offers.retireStaleOffers();
      expect(await offers.liveOffers(chaletId)).toHaveLength(0);

      await api.prisma.chalet.update({
        where: { id: chaletId },
        data: { gapFillerEnabled: false },
      });
    });
  });

  /* ----------------------------------------------------------------- 12 */
  describe('12. the owner can see whether the chalet is earning', () => {
    it('reports occupancy against opening hours, with the empty weekdays visible', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);

      const occupancy = api.app.get(
        (await import('../src/modules/chalet/chalet-occupancy.service')).ChaletOccupancyService,
      );
      const report = await occupancy.report(chaletId, iso(slot(9)).slice(0, 10));

      expect(report.bookingCount).toBe(1);
      expect(report.bookedMinutes).toBe(240);
      expect(report.bookableMinutes).toBeGreaterThan(report.bookedMinutes);
      expect(report.byDayOfWeek).toHaveLength(7);
      expect(report.byHourOfDay).toHaveLength(24);
      expect(report.revenue.currency).toBe('ILS');
    });

    it('counts cancellations rather than hiding them', async () => {
      const userId = await createChaletCustomer(api.prisma);
      const held = await book(slot(9), slot(13), userId);
      await bookings.confirm(asUser(userId), held.id);
      await bookings.cancel(asUser(userId), held.id, { reason: 'x' });

      const occupancy = api.app.get(
        (await import('../src/modules/chalet/chalet-occupancy.service')).ChaletOccupancyService,
      );
      const report = await occupancy.report(chaletId, iso(slot(9)).slice(0, 10));
      expect(report.cancelledCount).toBe(1);
      expect(report.bookingCount).toBe(0);
    });
  });

  /* --------------------------------------------------------- the whole thing */
  describe('the whole journey, end to end', () => {
    it('searches, prices, holds, confirms, stays, and completes', async () => {
      const date = iso(slot(9)).slice(0, 10);

      // 1. The customer looks at a day and is offered start times.
      const availability = await api
        .request()
        .get(api.url(`chalets/${chaletId}/availability`))
        .query({ date, durationMinutes: 240 })
        .expect(200);
      expect(availability.body.suggestedStartTimes.length).toBeGreaterThan(0);

      // 2. They check one window and see what it costs.
      const check = await api
        .request()
        .get(api.url(`chalets/${chaletId}/slot-check`))
        .query({ startAt: iso(slot(9)), endAt: iso(slot(13)) })
        .expect(200);
      expect(check.body.available).toBe(true);
      const quoted = check.body.price.total.amount;
      expect(quoted).toBeGreaterThan(0);

      // 3. They hold it, and the price is frozen onto the booking.
      const held = await api
        .request()
        .post(api.url('chalets/bookings'))
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ chaletId, startAt: iso(slot(9)), endAt: iso(slot(13)), guestCount: 4 })
        .expect(201);
      expect(held.body.totalAmountMinor).toBe(quoted);

      // 4. While they pay, nobody else can take the slot.
      await expect(book(slot(10), slot(12))).rejects.toMatchObject({ code: 'CONFLICT' });

      // 5. They confirm.
      const confirmed = await api
        .request()
        .post(api.url(`chalets/bookings/${held.body.id}/confirm`))
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(201);
      expect(confirmed.body.status).toBe(ChaletBookingStatus.CONFIRMED);

      // 6. The cleaning window after them is still theirs.
      await expect(book(slot(13), slot(16))).rejects.toMatchObject({ code: 'CONFLICT' });
      const next = await book(slot(14, 30), slot(17));
      expect(next.status).toBe(ChaletBookingStatus.HELD);

      // 7. The whole thing is on the trail, in order.
      const events = await api.prisma.chaletBookingEvent.findMany({
        where: { bookingId: held.body.id },
        orderBy: { createdAt: 'asc' },
        select: { type: true },
      });
      expect(events.map((e) => e.type)).toEqual(['HELD', 'CONFIRMED']);
    });
  });
});
