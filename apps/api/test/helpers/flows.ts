import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, JobDto, PaymentDto } from '@tamam/shared-types';

import { type AuthContext, RAMALLAH, type TestApp, sampleAt, waitFor } from './app';

export interface CashRideResult {
  jobId: string;
  jobNumber: string;
  finalTotalMinor: number;
  paymentId: string;
}

/**
 * Drives a complete CASH ride (estimate → dispatch → accept → drive → complete → capture) so
 * suites that need a settled job as a *precondition* do not restate the §125 journey. The ride
 * flow itself is asserted in `ride.e2e-spec.ts`.
 */
export async function runCashRide(
  api: TestApp,
  customer: AuthContext,
  partner: AuthContext,
  options: { vehicleTypeId: string; activeVehicleId: string; role?: 'DRIVER' | 'COURIER' },
): Promise<CashRideResult> {
  const pickup = {
    lat: RAMALLAH.lat,
    lng: RAMALLAH.lng,
    formatted: 'رام الله — دوار المنارة',
    city: 'Ramallah',
  };
  const destination = {
    lat: RAMALLAH.lat + 0.01,
    lng: RAMALLAH.lng + 0.011,
    formatted: 'البيرة — شارع القدس',
    city: 'Al-Bireh',
  };

  const estimate = (
    await api
      .request()
      .post(api.url('estimates/ride'))
      .set(customer.headers)
      .send({ pickup, destination })
      .expect(201)
  ).body as FareEstimateDto;

  const job = (
    await api
      .request()
      .post(api.url('jobs'))
      .set(customer.headers)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'RIDE',
        estimateId: estimate.estimateId,
        vehicleTypeId: options.vehicleTypeId,
        paymentMethod: 'CASH',
        scheduling: 'NOW',
        pickup,
        destination,
      })
      .expect(201)
  ).body as JobDto;

  await api
    .request()
    .put(api.url('partners/me/availability'))
    .set(partner.headers)
    .send({
      status: 'ONLINE',
      activeRoles: [options.role ?? 'DRIVER'],
      activeVehicleId: options.activeVehicleId,
      location: sampleAt(pickup.lat + 0.001, pickup.lng),
    })
    .expect(200);

  const offer = await waitFor(
    async () => {
      const res = await api.request().get(api.url('partners/me/offers')).set(partner.headers);
      const offers = (res.body as Array<{ assignmentId: string; job: { id: string } }>) ?? [];
      return offers.find((o) => o.job.id === job.id) ?? null;
    },
    { timeoutMs: 30_000, label: `dispatch offer for ${job.number}` },
  );

  await api
    .request()
    .post(api.url('partners/me/offers/respond'))
    .set(partner.headers)
    .send({ assignmentId: offer.assignmentId, accept: true })
    .expect(200);

  const assigned = (
    await api
      .request()
      .get(api.url(`jobs/${job.id}`))
      .set(partner.headers)
      .expect(200)
  ).body as JobDto;
  const enRoute = (
    await api
      .request()
      .post(api.url(`jobs/${job.id}/en-route`))
      .set(partner.headers)
      .send({ version: assigned.version })
      .expect(200)
  ).body as JobDto;
  const arrived = (
    await api
      .request()
      .post(api.url(`jobs/${job.id}/arrive`))
      .set(partner.headers)
      .send({ version: enRoute.version, location: sampleAt(pickup.lat, pickup.lng) })
      .expect(200)
  ).body as JobDto;

  const customerView = (
    await api
      .request()
      .get(api.url(`jobs/${job.id}`))
      .set(customer.headers)
      .expect(200)
  ).body as JobDto;
  const started = (
    await api
      .request()
      .post(api.url(`jobs/${job.id}/start`))
      .set(partner.headers)
      .send({
        version: arrived.version,
        ...(customerView.tripPin ? { tripPin: customerView.tripPin } : {}),
        location: sampleAt(pickup.lat, pickup.lng),
      })
      .expect(200)
  ).body as JobDto;

  const completed = (
    await api
      .request()
      .post(api.url(`jobs/${job.id}/complete`))
      .set(partner.headers)
      .send({ version: started.version, location: sampleAt(destination.lat, destination.lng) })
      .expect(200)
  ).body as JobDto;

  const payment = await waitFor(
    async () => {
      const res = await api
        .request()
        .get(api.url(`jobs/${job.id}/payment`))
        .set(customer.headers);
      const body = res.body as PaymentDto;
      return body.status === 'CAPTURED' ? body : null;
    },
    { timeoutMs: 20_000, label: 'cash capture' },
  );

  return {
    jobId: job.id,
    jobNumber: job.number,
    finalTotalMinor: completed.finalTotal?.amount ?? 0,
    paymentId: payment.id,
  };
}
