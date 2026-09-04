import { createHmac, randomUUID } from 'node:crypto';

import { optionalEnv } from '../src/config/env.schema';
import { PaymentsService, type RefundDto } from '../src/modules/payments/payments.service';

import { type AuthContext, SEED, TestApp, waitFor } from './helpers/app';
import { runCashRide } from './helpers/flows';
// RefundDto lives in the payments module, not in @tamam/shared-types (see the contract notes).

// Same trap as SEED_ADMIN_PASSWORD: .env ships this key empty, and `??` would keep ''.
const WEBHOOK_SECRET =
  optionalEnv(process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET) ?? 'mock-webhook-secret';

/**
 * Spec §129 — money must never be applied twice.
 *
 *  1. the same provider event id is stored and processed exactly once,
 *  2. replaying a refund with the same Idempotency-Key returns the first response, not a second refund,
 *  3. capturing a job twice books one settlement transaction.
 */
describe('Payment idempotency (§129)', () => {
  let api: TestApp;
  let customer: AuthContext;
  let partner: AuthContext;
  let admin: AuthContext;
  let payments: PaymentsService;
  let ride: Awaited<ReturnType<typeof runCashRide>>;

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();
    customer = await api.loginCustomer(SEED.customerPhone);
    partner = await api.loginPartner(SEED.driverPhone);
    admin = await api.loginAdmin();
    payments = api.app.get(PaymentsService);

    const economy = await api.prisma.vehicleType.findUniqueOrThrow({ where: { code: 'ECONOMY' } });
    const vehicle = await api.prisma.vehicle.findFirstOrThrow({
      where: { partnerId: partner.userId, vehicleTypeId: economy.id },
    });
    ride = await runCashRide(api, customer, partner, {
      vehicleTypeId: economy.id,
      activeVehicleId: vehicle.id,
    });
  }, 240_000);

  afterAll(async () => {
    await api?.close();
  });

  it('captures a job once even when captureForJob is called again', async () => {
    const before = await api.prisma.ledgerTransaction.count({
      where: { idempotencyKey: `settle:${ride.jobId}` },
    });
    expect(before).toBe(1);

    const result = await payments.captureForJob(ride.jobId);
    expect(result.payment.status).toBe('CAPTURED');

    const after = await api.prisma.ledgerTransaction.count({
      where: { idempotencyKey: `settle:${ride.jobId}` },
    });
    expect(after).toBe(1);

    const payment = await api.prisma.payment.findUniqueOrThrow({ where: { id: ride.paymentId } });
    expect(Number(payment.capturedMinor)).toBe(ride.finalTotalMinor);
    // One receipt, one settlement, one payment row for the job.
    expect(await api.prisma.receipt.count({ where: { jobId: ride.jobId } })).toBe(1);
    expect(await api.prisma.payment.count({ where: { jobId: ride.jobId } })).toBe(1);
  }, 60_000);

  it('replays a refund issued with the same Idempotency-Key instead of doubling it', async () => {
    const idempotencyKey = `e2e-refund-${randomUUID()}`;
    const body = {
      paymentId: ride.paymentId,
      amountMinor: 500,
      reason: 'Customer complained about the route',
    };

    const first = await api
      .request()
      .post(api.url('admin/refunds'))
      .set(admin.headers)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201);
    const firstRefund = first.body as RefundDto;
    expect(firstRefund.status).toBe('PROCESSED');
    expect(first.headers['idempotent-replayed']).toBeUndefined();

    const replay = await api
      .request()
      .post(api.url('admin/refunds'))
      .set(admin.headers)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
      .expect(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect((replay.body as RefundDto).id).toBe(firstRefund.id);

    expect(await api.prisma.refund.count({ where: { paymentId: ride.paymentId } })).toBe(1);
    expect(
      await api.prisma.ledgerTransaction.count({
        where: { type: 'REFUND', refundId: firstRefund.id },
      }),
    ).toBe(1);

    const payment = await api.prisma.payment.findUniqueOrThrow({ where: { id: ride.paymentId } });
    expect(Number(payment.refundedMinor)).toBe(500);
    expect(payment.status).toBe('PARTIALLY_REFUNDED');

    // Reusing the key with a different payload is a conflict, never a silent second refund.
    await api
      .request()
      .post(api.url('admin/refunds'))
      .set(admin.headers)
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...body, amountMinor: 700 })
      .expect(409)
      .expect((res) => expect((res.body as { code: string }).code).toBe('IDEMPOTENCY_KEY_REUSED'));
  }, 60_000);

  it('stores and processes a duplicated provider webhook exactly once', async () => {
    const refund = await api.prisma.refund.findFirstOrThrow({
      where: { paymentId: ride.paymentId },
    });
    // A CASH refund settles through the wallet and carries no providerRef; give the event one
    // that resolves to this refund so the processed path is exercised end to end.
    const providerRef = `mock_ref_${randomUUID()}`;
    await api.prisma.refund.update({
      where: { id: refund.id },
      data: { providerRef, status: 'PENDING', processedAt: null },
    });

    const eventId = `evt_${randomUUID()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'refund.processed',
      providerRef,
      amountMinor: 500,
    });
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.from(payload))
      .digest('hex');

    const send = () =>
      api
        .request()
        .post(api.url('payments/webhooks/mock'))
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(payload);

    const first = await send().expect(200);
    expect(first.body).toEqual({ received: true, duplicate: false });

    const second = await send().expect(200);
    expect(second.body).toEqual({ received: true, duplicate: true });

    expect(await api.prisma.webhookEvent.count({ where: { eventId } })).toBe(1);

    const processed = await waitFor(
      async () => {
        const row = await api.prisma.webhookEvent.findFirstOrThrow({ where: { eventId } });
        return row.processedAt ? row : null;
      },
      { timeoutMs: 20_000, label: 'webhook processed' },
    );
    expect(processed.attempts).toBe(1);
    expect(processed.lastError).toBeNull();

    const afterWebhook = await api.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(afterWebhook.status).toBe('PROCESSED');

    // The duplicate never produced a second ledger movement.
    expect(
      await api.prisma.ledgerTransaction.count({ where: { type: 'REFUND', refundId: refund.id } }),
    ).toBe(1);

    // An unsigned or wrongly signed webhook is rejected outright.
    await api
      .request()
      .post(api.url('payments/webhooks/mock'))
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', 'deadbeef')
      .send(payload)
      .expect(403);
  }, 90_000);
});
