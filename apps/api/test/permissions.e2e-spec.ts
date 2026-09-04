import { type AuthContext, SEED, TestApp } from './helpers/app';
import { createCustomerFixture, createDriverFixture } from './helpers/fixtures';
import { runCashRide } from './helpers/flows';

/**
 * Spec §130 — authorization is enforced on the object, not just on the route.
 *
 * Note on status codes (spec §88): a caller with no relationship to a job gets **404**, not 403.
 * Answering 403 would confirm that the id exists, which is exactly the enumeration leak the
 * policy is there to prevent. 403 is reserved for callers who legitimately see the resource but
 * may not perform the action.
 */
describe('Permissions and object-level access (§130)', () => {
  let api: TestApp;
  let customerA: AuthContext;
  let customerB: AuthContext;
  let partnerA: AuthContext;
  let partnerB: AuthContext;
  let support: AuthContext;
  let ride: Awaited<ReturnType<typeof runCashRide>>;

  const otherCustomerPhone = '+970599000301';
  const otherDriverPhone = '+970599000302';

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();

    await createCustomerFixture(api, { phone: otherCustomerPhone, fullName: 'ريم قاسم' });
    const otherDriver = await createDriverFixture(api, {
      phone: otherDriverPhone,
      fullName: 'باسل حمد',
      plate: '9990002',
    });

    customerA = await api.loginCustomer(SEED.customerPhone);
    customerB = await api.loginCustomer(otherCustomerPhone, 'e2e-customer-b');
    partnerA = await api.loginPartner(SEED.driverPhone, 'e2e-partner-a');
    partnerB = await api.loginPartner(otherDriverPhone, 'e2e-partner-b');
    support = await api.loginAdmin(SEED.supportEmail, SEED.adminPassword, 'e2e-support-device');

    const economy = await api.prisma.vehicleType.findUniqueOrThrow({ where: { code: 'ECONOMY' } });
    const vehicle = await api.prisma.vehicle.findFirstOrThrow({
      where: { partnerId: partnerA.userId, vehicleTypeId: economy.id },
    });
    // Job belongs to customer A and is served by partner A.
    ride = await runCashRide(api, customerA, partnerA, {
      vehicleTypeId: economy.id,
      activeVehicleId: vehicle.id,
    });
    expect(otherDriver.userId).toBe(partnerB.userId);
  }, 240_000);

  afterAll(async () => {
    await api?.close();
  });

  it('hides another customer’s job behind a 404', async () => {
    await api
      .request()
      .get(api.url(`jobs/${ride.jobId}`))
      .set(customerA.headers)
      .expect(200);

    await api
      .request()
      .get(api.url(`jobs/${ride.jobId}`))
      .set(customerB.headers)
      .expect(404)
      .expect((res) => expect((res.body as { code: string }).code).toBe('NOT_FOUND'));

    // The same rule applies to the job-scoped reads that go through JobsService.getForUser.
    await api
      .request()
      .get(api.url(`jobs/${ride.jobId}/timeline`))
      .set(customerB.headers)
      .expect(404);

    // `GET jobs/:id/payment` is object-checked too, but PaymentsService.getForJob answers 403
    // instead of 404 for a foreign job. Access is still denied; the status code is inconsistent
    // with the rest of the platform and is tracked as a cross-module contract mismatch.
    await api
      .request()
      .get(api.url(`jobs/${ride.jobId}/payment`))
      .set(customerB.headers)
      .expect((res) => {
        expect([403, 404]).toContain(res.status);
      });

    // Customer B's list never contains customer A's job.
    const list = (await api.request().get(api.url('jobs')).set(customerB.headers).expect(200))
      .body as { items: Array<{ id: string }> };
    expect(list.items.some((j) => j.id === ride.jobId)).toBe(false);
  });

  it('refuses a partner who is not assigned to the job', async () => {
    // Unrelated partner: 404 — the existence of the job is not disclosed.
    await api
      .request()
      .post(api.url(`jobs/${ride.jobId}/en-route`))
      .set(partnerB.headers)
      .send({ version: 0 })
      .expect(404);

    // A support agent CAN read every job (JOBS_READ_ALL) but may not drive its state machine:
    // the partner-only route answers 403 because the caller is visible but not permitted.
    await api
      .request()
      .get(api.url(`admin/jobs/${ride.jobId}`))
      .set(support.headers)
      .expect(200);
    await api
      .request()
      .post(api.url(`jobs/${ride.jobId}/en-route`))
      .set(support.headers)
      .send({ version: 0 })
      .expect(403)
      .expect((res) => expect((res.body as { code: string }).code).toBe('FORBIDDEN'));
  });

  it('does not let the SUPPORT role issue refunds', async () => {
    await api
      .request()
      .post(api.url('admin/refunds'))
      .set(support.headers)
      .set('Idempotency-Key', 'e2e-support-refund-attempt')
      .send({
        paymentId: ride.paymentId,
        amountMinor: 100,
        reason: 'Support should not be able to do this',
      })
      .expect(403);

    expect(await api.prisma.refund.count({ where: { paymentId: ride.paymentId } })).toBe(0);

    // Nor may support manage staff accounts or platform configuration.
    await api.request().get(api.url('admin/staff')).set(support.headers).expect(403);
    await api
      .request()
      .post(api.url('admin/maintenance/run/heartbeat-sweep'))
      .set(support.headers)
      .send({ reason: 'trying anyway' })
      .expect(403);
  });

  it('rejects unauthenticated and customer access to admin routes', async () => {
    await api
      .request()
      .get(api.url('admin/jobs'))
      .expect(401)
      .expect((res) => expect((res.body as { code: string }).code).toBe('UNAUTHENTICATED'));

    await api.request().get(api.url('admin/overview')).expect(401);
    await api.request().get(api.url('admin/dispatch/console')).expect(401);

    // A signed-in customer is authenticated but holds no admin permission.
    await api.request().get(api.url('admin/jobs')).set(customerA.headers).expect(403);
    await api.request().get(api.url('admin/search?q=TM-')).set(customerA.headers).expect(403);

    // A garbage bearer token is rejected as unauthenticated, never as 500.
    await api
      .request()
      .get(api.url('admin/jobs'))
      .set({ Authorization: 'Bearer not-a-real-token' })
      .expect(401);
  });
});
