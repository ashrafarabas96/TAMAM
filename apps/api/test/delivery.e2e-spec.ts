import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, JobDto } from '@tamam/shared-types';

import { type AuthContext, RAMALLAH, SEED, TestApp, sampleAt, waitFor } from './helpers/app';

/**
 * Spec §126 — delivery journey with both verification codes and proof of delivery:
 * pickup OTP at collection, delivery OTP at hand-over, POD stored on the job.
 */
describe('Delivery end-to-end (§126)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let courier: AuthContext;
  let motorbikeTypeId: string;
  let activeVehicleId: string;
  let packageCategoryId: string;

  const pickup = { lat: RAMALLAH.lat + 0.002, lng: RAMALLAH.lng - 0.001, formatted: 'رام الله — المصيون', city: 'Ramallah' };
  const destination = { lat: RAMALLAH.lat - 0.01, lng: RAMALLAH.lng + 0.009, formatted: 'رام الله — بيتونيا', city: 'Ramallah' };

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();
    customer = await api.loginCustomer(SEED.customerPhone);
    courier = await api.loginPartner(SEED.courierPhone, 'e2e-courier-device');

    const motorbike = await api.prisma.vehicleType.findUniqueOrThrow({ where: { code: 'MOTORBIKE' } });
    motorbikeTypeId = motorbike.id;
    activeVehicleId = (await api.prisma.vehicle.findFirstOrThrow({ where: { partnerId: courier.userId } })).id;
    packageCategoryId = (await api.prisma.packageCategory.findUniqueOrThrow({ where: { code: 'SMALL' } })).id;
  }, 180_000);

  afterAll(async () => {
    await api?.close();
  });

  const getJob = async (auth: AuthContext, jobId: string): Promise<JobDto> => {
    const res = await api.request().get(api.url(`jobs/${jobId}`)).set(auth.headers).expect(200);
    return res.body as JobDto;
  };

  it('verifies the pickup OTP, the delivery OTP and stores proof of delivery', async () => {
    const estimate = (
      await api
        .request()
        .post(api.url('estimates/delivery'))
        .set(customer.headers)
        .send({ pickup, destination, packageCategoryId, approximateSize: 'SMALL', approximateWeightKg: 2, urgency: 'STANDARD' })
        .expect(201)
    ).body as FareEstimateDto;
    expect(estimate.options.some((o) => o.vehicleTypeId === motorbikeTypeId)).toBe(true);

    const created = (
      await api
        .request()
        .post(api.url('jobs'))
        .set(customer.headers)
        .set('Idempotency-Key', randomUUID())
        .send({
          type: 'DELIVERY',
          estimateId: estimate.estimateId,
          vehicleTypeId: motorbikeTypeId,
          paymentMethod: 'CASH',
          scheduling: 'NOW',
          pickup,
          destination,
          packageCategoryId,
          approximateSize: 'SMALL',
          approximateWeightKg: 2,
          sender: { name: 'سارة أحمد', phone: SEED.customerPhone },
          recipient: { name: 'ليان يوسف', phone: '+970599111222' },
          description: 'ظرف مستندات',
          deliveryNotes: 'الطابق الثاني',
        })
        .expect(201)
    ).body as JobDto;

    const jobId = created.id;
    expect(created.pickupOtpRequired).toBe(true);
    expect(created.deliveryOtpRequired).toBe(true);
    // Only the customer (the sender) receives the codes.
    expect(created.pickupOtp).toMatch(/^\d{4}$/);
    expect(created.deliveryOtp).toMatch(/^\d{4}$/);
    const pickupOtp = created.pickupOtp as string;
    const deliveryOtp = created.deliveryOtp as string;

    await api
      .request()
      .put(api.url('partners/me/availability'))
      .set(courier.headers)
      .send({ status: 'ONLINE', activeRoles: ['COURIER'], activeVehicleId, location: sampleAt(pickup.lat + 0.001, pickup.lng) })
      .expect(200);

    const offer = await waitFor(
      async () => {
        const res = await api.request().get(api.url('partners/me/offers')).set(courier.headers);
        const offers = (res.body as Array<{ assignmentId: string; job: { id: string } }>) ?? [];
        return offers.find((o) => o.job.id === jobId) ?? null;
      },
      { timeoutMs: 30_000, label: 'dispatch offer for the delivery' },
    );

    await api
      .request()
      .post(api.url('partners/me/offers/respond'))
      .set(courier.headers)
      .send({ assignmentId: offer.assignmentId, accept: true, location: sampleAt(pickup.lat + 0.001, pickup.lng) })
      .expect(200);

    // The courier must never see the codes on their own view of the job.
    const courierView = await getJob(courier, jobId);
    expect(courierView.pickupOtp).toBeUndefined();
    expect(courierView.deliveryOtp).toBeUndefined();

    const enRoute = (
      await api.request().post(api.url(`jobs/${jobId}/en-route`)).set(courier.headers).send({ version: courierView.version }).expect(200)
    ).body as JobDto;

    const arrived = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/arrive`))
        .set(courier.headers)
        .send({ version: enRoute.version, location: sampleAt(pickup.lat, pickup.lng) })
        .expect(200)
    ).body as JobDto;

    /* ------------------------------------------------------- pickup OTP */
    const badPickup = await api
      .request()
      .post(api.url(`jobs/${jobId}/start`))
      .set(courier.headers)
      .send({ version: arrived.version, pickupOtp: pickupOtp === '0000' ? '1111' : '0000' })
      .expect(400);
    expect((badPickup.body as { code: string }).code).toBe('PICKUP_OTP_INVALID');

    const started = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/start`))
        .set(courier.headers)
        .send({ version: arrived.version, pickupOtp, location: sampleAt(pickup.lat, pickup.lng) })
        .expect(200)
    ).body as JobDto;
    expect(started.status).toBe('IN_PROGRESS');

    const afterPickup = await api.prisma.jobDeliveryDetails.findUniqueOrThrow({ where: { jobId } });
    expect(afterPickup.pickupVerifiedAt).not.toBeNull();
    expect(afterPickup.pickupVerifiedMethod).toBe('OTP');

    /* ----------------------------------------------- delivery OTP + POD */
    const badDelivery = await api
      .request()
      .post(api.url(`jobs/${jobId}/complete`))
      .set(courier.headers)
      .send({
        version: started.version,
        location: sampleAt(destination.lat, destination.lng),
        proofOfDelivery: { deliveryOtp: deliveryOtp === '0000' ? '1111' : '0000', receiverName: 'ليان يوسف' },
      })
      .expect(400);
    expect((badDelivery.body as { code: string }).code).toBe('DELIVERY_OTP_INVALID');

    const completed = (
      await api
        .request()
        .post(api.url(`jobs/${jobId}/complete`))
        .set(courier.headers)
        .send({
          version: started.version,
          location: sampleAt(destination.lat, destination.lng),
          proofOfDelivery: { deliveryOtp, receiverName: 'ليان يوسف' },
        })
        .expect(200)
    ).body as JobDto;
    expect(completed.status).toBe('COMPLETED');

    const pod = await api.prisma.jobDeliveryDetails.findUniqueOrThrow({ where: { jobId } });
    expect(pod.podOtpVerified).toBe(true);
    expect(pod.podReceiverName).toBe('ليان يوسف');
    expect(pod.podTimestamp).not.toBeNull();
    expect(pod.podLat).not.toBeNull();

    // The customer's DTO exposes the proof; recipient phone stays masked for them.
    const customerFinal = await getJob(customer, jobId);
    expect(customerFinal.delivery?.proof?.otpVerified).toBe(true);
    expect(customerFinal.delivery?.recipientPhone).toContain('***');

    const receipt = await api.prisma.receipt.findUnique({ where: { jobId } });
    expect(receipt).not.toBeNull();
  }, 180_000);
});
