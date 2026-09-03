import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, JobDto, PaymentDto } from '@tamam/shared-types';

import { type AuthContext, RAMALLAH, SEED, TestApp, sampleAt, waitFor } from './helpers/app';

/**
 * Spec §125 — the complete ride journey against a real Postgres/PostGIS + Redis stack:
 * estimate → create → partner online → dispatch offer → accept → en route → arrive → start
 * (trip PIN) → complete → CASH capture → receipt → two-way rating.
 */
describe('Ride end-to-end (§125)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let partner: AuthContext;
  let economyVehicleTypeId: string;
  let activeVehicleId: string;

  const pickup = { lat: RAMALLAH.lat, lng: RAMALLAH.lng, formatted: 'رام الله — دوار المنارة', city: 'Ramallah' };
  const destination = { lat: RAMALLAH.lat + 0.012, lng: RAMALLAH.lng + 0.014, formatted: 'البيرة — شارع القدس', city: 'Al-Bireh' };

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();
    customer = await api.loginCustomer(SEED.customerPhone);
    partner = await api.loginPartner(SEED.driverPhone);

    const economy = await api.prisma.vehicleType.findUniqueOrThrow({ where: { code: 'ECONOMY' } });
    economyVehicleTypeId = economy.id;
    const vehicle = await api.prisma.vehicle.findFirstOrThrow({ where: { partnerId: partner.userId, vehicleTypeId: economyVehicleTypeId } });
    activeVehicleId = vehicle.id;
  }, 180_000);

  afterAll(async () => {
    await api?.close();
  });

  const getJob = async (auth: AuthContext, jobId: string): Promise<JobDto> => {
    const res = await api.request().get(api.url(`jobs/${jobId}`)).set(auth.headers).expect(200);
    return res.body as JobDto;
  };

  it('carries a ride from estimate to a rated, paid, receipted trip', async () => {
    /* ------------------------------------------------------------ estimate */
    const estimateRes = await api
      .request()
      .post(api.url('estimates/ride'))
      .set(customer.headers)
      .send({ pickup, destination })
      .expect(201);
    const estimate = estimateRes.body as FareEstimateDto;

    expect(estimate.estimateId).toBeTruthy();
    expect(estimate.currency).toBe('ILS');
    const economyOption = estimate.options.find((o) => o.vehicleTypeId === economyVehicleTypeId);
    expect(economyOption).toBeDefined();
    // Server-side pricing only: the fare must respect the seeded 10 ILS minimum.
    expect(economyOption?.total.amount).toBeGreaterThanOrEqual(1000);

    /* -------------------------------------------------------- create the job */
    const createRes = await api
      .request()
      .post(api.url('jobs'))
      .set(customer.headers)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'RIDE',
        estimateId: estimate.estimateId,
        vehicleTypeId: economyVehicleTypeId,
        paymentMethod: 'CASH',
        scheduling: 'NOW',
        pickup,
        destination,
      })
      .expect(201);
    const created = createRes.body as JobDto;
    expect(created.status).toBe('REQUESTED');
    expect(created.number).toMatch(/^TM-\d{4}-\d{6}$/);
    const jobId = created.id;

    /* --------------------------------------------------- partner goes online */
    await api
      .request()
      .put(api.url('partners/me/availability'))
      .set(partner.headers)
      .send({ status: 'ONLINE', activeRoles: ['DRIVER'], activeVehicleId, location: sampleAt(RAMALLAH.lat + 0.001, RAMALLAH.lng + 0.001) })
      .expect(200);

    /* ------------------------------------------- dispatch offers the job */
    const offer = await waitFor(
      async () => {
        const res = await api.request().get(api.url('partners/me/offers')).set(partner.headers);
        const offers = (res.body as Array<{ assignmentId: string; job: { id: string } }>) ?? [];
        return offers.find((o) => o.job.id === jobId) ?? null;
      },
      { timeoutMs: 30_000, label: 'dispatch offer for the ride' },
    );
    expect(offer.assignmentId).toBeTruthy();

    const accepted = await api
      .request()
      .post(api.url('partners/me/offers/respond'))
      .set(partner.headers)
      .send({ assignmentId: offer.assignmentId, accept: true, location: sampleAt(RAMALLAH.lat + 0.001, RAMALLAH.lng + 0.001) })
      .expect(200);
    expect((accepted.body as JobDto).status).toBe('ASSIGNED');

    /* ------------------------------------------- the customer sees the partner */
    const assigned = await getJob(customer, jobId);
    expect(assigned.status).toBe('ASSIGNED');
    expect(assigned.partnerId).toBe(partner.userId);
    expect(assigned.partner?.fullName).toBeTruthy();
    expect(assigned.partner?.vehicle?.plate).toBeTruthy();
    // The customer never sees the raw partner phone number.
    expect(assigned.partner?.maskedPhone).toContain('***');

    /* ------------------------------------------------------------- en route */
    const enRoute = await api
      .request()
      .post(api.url(`jobs/${jobId}/en-route`))
      .set(partner.headers)
      .send({ version: assigned.version })
      .expect(200);
    expect((enRoute.body as JobDto).status).toBe('PARTNER_EN_ROUTE');

    /* -------------------------------------------------------------- arrive */
    const arrived = await api
      .request()
      .post(api.url(`jobs/${jobId}/arrive`))
      .set(partner.headers)
      .send({ version: (enRoute.body as JobDto).version, location: sampleAt(pickup.lat, pickup.lng) })
      .expect(200);
    expect((arrived.body as JobDto).status).toBe('PARTNER_ARRIVED');

    /* ------------------------------------------- start with the customer's PIN */
    const customerView = await getJob(customer, jobId);
    expect(customerView.tripPinRequired).toBe(true);
    const tripPin = customerView.tripPin;
    expect(tripPin).toMatch(/^\d{4}$/);

    // The partner must not be able to read the PIN from their own view of the job.
    const partnerView = await getJob(partner, jobId);
    expect(partnerView.tripPin).toBeUndefined();

    // A wrong PIN is rejected with the typed error and leaves the job untouched.
    const wrongPin = tripPin === '0000' ? '1111' : '0000';
    const rejected = await api
      .request()
      .post(api.url(`jobs/${jobId}/start`))
      .set(partner.headers)
      .send({ version: (arrived.body as JobDto).version, tripPin: wrongPin })
      .expect(400);
    expect((rejected.body as { code: string }).code).toBe('TRIP_PIN_INVALID');

    const started = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/start`))
        .set(partner.headers)
        .send({ version: (arrived.body as JobDto).version, tripPin, location: sampleAt(pickup.lat, pickup.lng) })
        .expect(200)
    ).body as JobDto;
    expect(started.status).toBe('IN_PROGRESS');

    /* ------------------------------------------------------------ complete */
    const completed = await api
      .request()
      .post(api.url(`jobs/${jobId}/complete`))
      .set(partner.headers)
      .send({ version: started.version, location: sampleAt(destination.lat, destination.lng) })
      .expect(200);
    const finalJob = completed.body as JobDto;
    expect(finalJob.status).toBe('COMPLETED');
    expect(finalJob.finalTotal?.amount).toBeGreaterThanOrEqual(1000);

    /* ------------------------------------------------- payment + receipt */
    const payment = await waitFor(
      async () => {
        const res = await api.request().get(api.url(`jobs/${jobId}/payment`)).set(customer.headers);
        const body = res.body as PaymentDto;
        return body.status === 'CAPTURED' ? body : null;
      },
      { timeoutMs: 20_000, label: 'cash payment capture' },
    );
    expect(payment.method).toBe('CASH');
    expect(payment.amount.amount).toBe(finalJob.finalTotal?.amount);

    const receipt = await api.prisma.receipt.findUnique({ where: { jobId } });
    expect(receipt).not.toBeNull();
    expect(receipt?.number).toMatch(/^RC-\d{4}-\d{6}$/);
    expect(Number(receipt?.totalMinor)).toBe(finalJob.finalTotal?.amount);

    // The double-entry ledger must balance for this job.
    const entries = await api.prisma.ledgerEntry.findMany({ where: { transaction: { jobId } } });
    expect(entries.length).toBeGreaterThan(0);
    const balance = entries.reduce((sum, e) => sum + (e.direction === 'DEBIT' ? e.amountMinor : -e.amountMinor), 0n);
    expect(balance).toBe(0n);

    /* -------------------------------------------------------- two-way rating */
    const customerRating = await api
      .request()
      .post(api.url(`jobs/${jobId}/rating`))
      .set(customer.headers)
      .send({ rating: 5, tags: ['polite'], comment: 'سائق ممتاز' })
      .expect(201);
    expect((customerRating.body as { rating: number }).rating).toBe(5);

    const partnerRating = await api
      .request()
      .post(api.url(`jobs/${jobId}/rating`))
      .set(partner.headers)
      .send({ rating: 4, tags: [], comment: 'Smooth trip' })
      .expect(201);
    expect((partnerRating.body as { rating: number }).rating).toBe(4);

    const reviews = await api.prisma.review.findMany({ where: { jobId } });
    expect(reviews).toHaveLength(2);
    expect(new Set(reviews.map((r) => r.direction))).toEqual(new Set(['CUSTOMER_TO_PARTNER', 'PARTNER_TO_CUSTOMER']));

    const partnerProfile = await api.prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.userId } });
    expect(partnerProfile.completedJobs).toBe(1);
    expect(partnerProfile.ratingCount).toBe(1);
  }, 180_000);
});
