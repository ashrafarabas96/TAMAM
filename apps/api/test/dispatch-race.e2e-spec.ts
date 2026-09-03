import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, JobDto } from '@tamam/shared-types';

import { type AuthContext, RAMALLAH, SEED, TestApp, sampleAt, waitFor } from './helpers/app';
import { createDriverFixture } from './helpers/fixtures';

interface OfferLike {
  assignmentId: string;
  job: { id: string };
}

/**
 * Spec §128 — the dispatch race.
 *
 * Two eligible drivers are offered the same ride and both press "accept" at the same instant.
 * Exactly one may win. Three independent guards make that true (spec §22):
 *   1. a Redis lock around `job:<id>`,
 *   2. `SELECT … FOR UPDATE` on the job row inside the transaction,
 *   3. the partial unique index `uq_job_assignments_one_accepted`.
 * This test asserts the observable contract: one 200, one 409 with a typed code, and exactly one
 * ACCEPTED assignment row in the database.
 */
describe('Dispatch race (§128)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let driverA: AuthContext;
  let driverB: AuthContext;
  let vehicleA: string;
  let vehicleB: string;
  let economyVehicleTypeId: string;

  const secondDriverPhone = '+970599000202';
  const pickup = { lat: RAMALLAH.lat, lng: RAMALLAH.lng, formatted: 'رام الله — دوار المنارة', city: 'Ramallah' };
  const destination = { lat: RAMALLAH.lat + 0.01, lng: RAMALLAH.lng + 0.01, formatted: 'البيرة', city: 'Al-Bireh' };

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();

    const second = await createDriverFixture(api, { phone: secondDriverPhone, fullName: 'سامي درويش', plate: '9990001' });
    vehicleB = second.vehicleId;

    customer = await api.loginCustomer(SEED.customerPhone);
    driverA = await api.loginPartner(SEED.driverPhone, 'e2e-race-a');
    driverB = await api.loginPartner(secondDriverPhone, 'e2e-race-b');

    const economy = await api.prisma.vehicleType.findUniqueOrThrow({ where: { code: 'ECONOMY' } });
    economyVehicleTypeId = economy.id;
    vehicleA = (await api.prisma.vehicle.findFirstOrThrow({ where: { partnerId: driverA.userId, vehicleTypeId: economyVehicleTypeId } })).id;
  }, 180_000);

  afterAll(async () => {
    await api?.close();
  });

  it('lets exactly one partner win a simultaneous accept', async () => {
    // Both drivers are online, a few hundred metres apart, so wave 1 offers to both.
    await api
      .request()
      .put(api.url('partners/me/availability'))
      .set(driverA.headers)
      .send({ status: 'ONLINE', activeRoles: ['DRIVER'], activeVehicleId: vehicleA, location: sampleAt(pickup.lat + 0.001, pickup.lng) })
      .expect(200);
    await api
      .request()
      .put(api.url('partners/me/availability'))
      .set(driverB.headers)
      .send({ status: 'ONLINE', activeRoles: ['DRIVER'], activeVehicleId: vehicleB, location: sampleAt(pickup.lat - 0.001, pickup.lng) })
      .expect(200);

    const estimate = (await api.request().post(api.url('estimates/ride')).set(customer.headers).send({ pickup, destination }).expect(201)).body as FareEstimateDto;
    const job = (
      await api
        .request()
        .post(api.url('jobs'))
        .set(customer.headers)
        .set('Idempotency-Key', randomUUID())
        .send({ type: 'RIDE', estimateId: estimate.estimateId, vehicleTypeId: economyVehicleTypeId, paymentMethod: 'CASH', scheduling: 'NOW', pickup, destination })
        .expect(201)
    ).body as JobDto;

    /* ------------------------------------- both partners receive the offer */
    const findOffer = async (auth: AuthContext): Promise<OfferLike | null> => {
      const res = await api.request().get(api.url('partners/me/offers')).set(auth.headers);
      const offers = (res.body as OfferLike[]) ?? [];
      return offers.find((o) => o.job.id === job.id) ?? null;
    };

    const [offerA, offerB] = await waitFor(
      async () => {
        const [a, b] = await Promise.all([findOffer(driverA), findOffer(driverB)]);
        return a && b ? ([a, b] as const) : null;
      },
      { timeoutMs: 30_000, label: 'both drivers offered the same job' },
    );
    expect(offerA.assignmentId).not.toBe(offerB.assignmentId);

    const offered = await api.prisma.jobAssignment.count({ where: { jobId: job.id, status: 'OFFERED' } });
    expect(offered).toBe(2);

    /* ------------------------------------------ simultaneous accept attempts */
    const [resA, resB] = await Promise.all([
      api.request().post(api.url('partners/me/offers/respond')).set(driverA.headers).send({ assignmentId: offerA.assignmentId, accept: true }),
      api.request().post(api.url('partners/me/offers/respond')).set(driverB.headers).send({ assignmentId: offerB.assignmentId, accept: true }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const loser = resA.status === 409 ? resA : resB;
    const winner = resA.status === 200 ? resA : resB;
    expect(['JOB_ALREADY_ASSIGNED', 'OFFER_EXPIRED']).toContain((loser.body as { code: string }).code);
    expect((winner.body as JobDto).status).toBe('ASSIGNED');

    /* ------------------------------------------------ the database agrees */
    const accepted = await api.prisma.jobAssignment.findMany({ where: { jobId: job.id, status: 'ACCEPTED' } });
    expect(accepted).toHaveLength(1);

    const stored = await api.prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.status).toBe('ASSIGNED');
    expect(stored.partnerId).toBe(accepted[0]?.partnerId);

    // The loser's offer is closed, not left dangling.
    const open = await api.prisma.jobAssignment.count({ where: { jobId: job.id, status: 'OFFERED' } });
    expect(open).toBe(0);

    // Only the winner is BUSY on this job.
    const busy = await api.prisma.partnerAvailability.findMany({ where: { currentJobId: job.id } });
    expect(busy).toHaveLength(1);
    expect(busy[0]?.partnerId).toBe(accepted[0]?.partnerId);
  }, 180_000);
});
