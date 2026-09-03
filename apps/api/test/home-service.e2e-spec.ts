import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, JobDto, QuoteDto } from '@tamam/shared-types';

import { type AuthContext, RAMALLAH, SEED, TestApp, sampleAt, waitFor } from './helpers/app';

/**
 * Spec §127 — home service with the inspection/quote workflow:
 * create → technician accepts → arrive → start (INSPECTION_STARTED → QUOTE_REQUIRED) →
 * quote → customer approves → work → customer confirms → COMPLETED at the quoted total,
 * with a balanced ledger verified through the finance endpoint.
 *
 * Media upload is intentionally not exercised here: the seeded plumbing category has
 * `minImages: 0`, so the flow never depends on object storage being reachable.
 */
describe('Home service end-to-end (§127)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let technician: AuthContext;
  let admin: AuthContext;
  let categoryId: string;

  const location = { lat: RAMALLAH.lat + 0.004, lng: RAMALLAH.lng + 0.003, formatted: 'رام الله — حي الطيرة، عمارة 12', city: 'Ramallah' };

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();
    customer = await api.loginCustomer(SEED.customerPhone);
    technician = await api.loginPartner(SEED.technicianPhone, 'e2e-technician-device');
    admin = await api.loginAdmin();
    categoryId = (await api.prisma.serviceCategory.findUniqueOrThrow({ where: { slug: 'plumbing' } })).id;
  }, 180_000);

  afterAll(async () => {
    await api?.close();
  });

  const getJob = async (auth: AuthContext, jobId: string): Promise<JobDto> => {
    const res = await api.request().get(api.url(`jobs/${jobId}`)).set(auth.headers).expect(200);
    return res.body as JobDto;
  };

  it('runs inspection → quote → approval → work → confirmation and settles the ledger', async () => {
    const estimate = (
      await api
        .request()
        .post(api.url('estimates/service'))
        .set(customer.headers)
        .send({ location, categoryId, urgency: 'STANDARD', optionIds: [] })
        .expect(201)
    ).body as FareEstimateDto;
    expect(estimate.options).toHaveLength(1);
    // Inspection-quote categories quote the inspection fee upfront (30 ILS seeded).
    expect(estimate.options[0]?.total.amount).toBe(3000);

    const created = (
      await api
        .request()
        .post(api.url('jobs'))
        .set(customer.headers)
        .set('Idempotency-Key', randomUUID())
        .send({
          type: 'HOME_SERVICE',
          estimateId: estimate.estimateId,
          paymentMethod: 'CASH',
          scheduling: 'NOW',
          location,
          categoryId,
          optionIds: [],
          mediaIds: [],
          urgency: 'STANDARD',
          description: 'يوجد تسريب مياه أسفل مغسلة المطبخ منذ يومين.',
          dynamicFields: { leak_location: 'kitchen', urgency_note: 'this_week' },
        })
        .expect(201)
    ).body as JobDto;
    const jobId = created.id;
    expect(created.status).toBe('REQUESTED');
    expect(created.dynamicFields.leak_location).toBe('kitchen');

    /* ------------------------------------------------ technician goes online */
    await api
      .request()
      .put(api.url('partners/me/availability'))
      .set(technician.headers)
      .send({ status: 'ONLINE', activeRoles: ['TECHNICIAN'], location: sampleAt(location.lat + 0.002, location.lng) })
      .expect(200);

    const offer = await waitFor(
      async () => {
        const res = await api.request().get(api.url('partners/me/offers')).set(technician.headers);
        const offers = (res.body as Array<{ assignmentId: string; job: { id: string } }>) ?? [];
        return offers.find((o) => o.job.id === jobId) ?? null;
      },
      { timeoutMs: 30_000, label: 'dispatch offer for the home service' },
    );
    await api
      .request()
      .post(api.url('partners/me/offers/respond'))
      .set(technician.headers)
      .send({ assignmentId: offer.assignmentId, accept: true })
      .expect(200);

    /* --------------------------------------------------- arrive and inspect */
    let job = await getJob(technician, jobId);
    const enRoute = (await api.request().post(api.url(`jobs/${jobId}/en-route`)).set(technician.headers).send({ version: job.version }).expect(200)).body as JobDto;
    const arrived = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/arrive`))
        .set(technician.headers)
        .send({ version: enRoute.version, location: sampleAt(location.lat, location.lng) })
        .expect(200)
    ).body as JobDto;
    expect(arrived.status).toBe('PARTNER_ARRIVED');

    await api.request().post(api.url(`jobs/${jobId}/start`)).set(technician.headers).send({ version: arrived.version }).expect(200);

    // start() moves to INSPECTION_STARTED and the system immediately asks for a quote.
    job = await waitFor(
      async () => {
        const current = await getJob(technician, jobId);
        return current.status === 'QUOTE_REQUIRED' ? current : null;
      },
      { timeoutMs: 15_000, label: 'QUOTE_REQUIRED after inspection' },
    );

    const timeline = (await api.request().get(api.url(`jobs/${jobId}/timeline`)).set(technician.headers).expect(200)).body as Array<{ toStatus: string }>;
    expect(timeline.map((e) => e.toStatus)).toEqual(expect.arrayContaining(['INSPECTION_STARTED', 'QUOTE_REQUIRED']));

    /* ------------------------------------------------------------- quoting */
    const quote = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/quotes`))
        .set(technician.headers)
        .send({
          kind: 'INITIAL',
          version: job.version,
          description: 'تغيير سيفون وتركيب وصلة جديدة',
          estimatedDurationMin: 90,
          discountMinor: 0,
          items: [
            { kind: 'LABOR', description: 'أجرة العمل', quantity: 1, unitPriceMinor: 12000 },
            { kind: 'PARTS', description: 'سيفون ووصلات', quantity: 1, unitPriceMinor: 8000 },
          ],
        })
        .expect(201)
    ).body as QuoteDto;
    expect(quote.status).toBe('SUBMITTED');
    expect(quote.total.amount).toBe(20000);

    job = await getJob(customer, jobId);
    expect(job.status).toBe('QUOTE_SUBMITTED');
    expect(job.activeQuote?.total.amount).toBe(20000);

    // A partner cannot approve their own quote.
    await api
      .request()
      .post(api.url(`jobs/${jobId}/quotes/decision`))
      .set(technician.headers)
      .send({ decision: 'APPROVE', version: job.version })
      .expect(403);

    const approved = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/quotes/decision`))
        .set(customer.headers)
        .send({ decision: 'APPROVE', version: job.version, note: 'موافق' })
        .expect(200)
    ).body as QuoteDto;
    expect(approved.status).toBe('APPROVED');

    /* --------------------------------------------------------------- work */
    job = await getJob(technician, jobId);
    expect(job.status).toBe('QUOTE_APPROVED');
    const workStarted = (await api.request().post(api.url(`jobs/${jobId}/work/start`)).set(technician.headers).send({ version: job.version }).expect(200)).body as JobDto;
    expect(workStarted.status).toBe('WORK_STARTED');

    const workCompleted = (
      await api.request().post(api.url(`jobs/${jobId}/work/complete`)).set(technician.headers).send({ version: workStarted.version }).expect(200)
    ).body as JobDto;
    expect(workCompleted.status).toBe('WORK_COMPLETED');

    /* -------------------------------------------------- customer confirms */
    const confirmed = (
      await api.request().post(api.url(`jobs/${jobId}/confirm-work`)).set(customer.headers).send({ version: workCompleted.version }).expect(200)
    ).body as JobDto;
    expect(confirmed.status).toBe('COMPLETED');
    // The approved quote — not the inspection estimate — is the final price.
    expect(confirmed.finalTotal?.amount).toBe(20000);

    /* --------------------------------------------------- money is balanced */
    const payment = await waitFor(
      async () => {
        const res = await api.request().get(api.url(`jobs/${jobId}/payment`)).set(customer.headers);
        return (res.body as { status: string }).status === 'CAPTURED' ? (res.body as { amount: { amount: number } }) : null;
      },
      { timeoutMs: 20_000, label: 'home-service payment capture' },
    );
    expect(payment.amount.amount).toBe(20000);

    const entries = await api.prisma.ledgerEntry.findMany({ where: { transaction: { jobId } } });
    expect(entries.length).toBeGreaterThan(0);
    const net = entries.reduce((sum, e) => sum + (e.direction === 'DEBIT' ? e.amountMinor : -e.amountMinor), 0n);
    expect(net).toBe(0n);

    // The finance endpoint recomputes the wallet from the entries and must agree with the cache.
    const partnerWallet = await api.prisma.wallet.findFirstOrThrow({ where: { partnerId: technician.userId } });
    const verify = (await api.request().post(api.url(`admin/ledger/wallets/${partnerWallet.id}/verify`)).set(admin.headers).expect(201)).body as {
      matches: boolean;
      cachedBalance: { amount: number };
      recomputedBalance: { amount: number };
    };
    expect(verify.matches).toBe(true);
    expect(verify.cachedBalance.amount).toBe(verify.recomputedBalance.amount);

    // CASH job: the technician kept the 200 ILS, so their wallet carries the 15 % commission owed.
    expect(verify.cachedBalance.amount).toBe(-3000);

    const revenueAccount = await api.prisma.ledgerAccount.findUniqueOrThrow({ where: { code: 'PLATFORM_REVENUE:ILS' } });
    const revenue = entries.filter((e) => e.accountId === revenueAccount.id).reduce((sum, e) => sum + (e.direction === 'CREDIT' ? e.amountMinor : -e.amountMinor), 0n);
    expect(revenue).toBe(3000n);
  }, 240_000);
});
