import { type AuthContext, SEED, TestApp } from './helpers/app';
import { createChaletFixture } from './helpers/chalet';

/**
 * Chalet approval in the console (§82).
 *
 * A chalet goes live because a person said so, so what matters here is that
 * the decision is guarded by permission, that a rejection carries a reason the
 * owner can act on, and that approving really does make the chalet bookable —
 * an approved chalet that stays invisible is a bug a reviewer cannot see.
 */
describe('Chalet admin approval (§82)', () => {
  let api: TestApp;
  let admin: AuthContext;
  let customer: AuthContext;
  let chaletId: string;

  beforeAll(async () => {
    api = await TestApp.boot();
    admin = await api.loginAdmin();
    customer = await api.loginCustomer(SEED.customerPhone);
    ({ chaletId } = await createChaletFixture(api.prisma, {
      status: 'PENDING_APPROVAL',
      approvalStatus: 'PENDING',
    }));
  }, 180_000);

  afterAll(async () => {
    await api.close();
  });

  const asAdmin = () => api.request().set('Authorization', `Bearer ${admin.accessToken}`);

  it('lists chalets waiting for a decision', async () => {
    const res = await api
      .request()
      .get(api.url('admin/chalets'))
      .query({ approvalStatus: 'PENDING' })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const found = res.body.items.find((c: { id: string }) => c.id === chaletId);
    expect(found).toBeDefined();
    expect(found.approvalStatus).toBe('PENDING');
    // What a reviewer needs to judge readiness, on the row itself.
    expect(found.photoCount).toBe(0);
    expect(typeof found.ownerPhone).toBe('string');
  });

  it('counts what is waiting, for the console badge', async () => {
    const res = await api
      .request()
      .get(api.url('admin/chalets/pending-count'))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(res.body.pending).toBeGreaterThanOrEqual(1);
  });

  it('serves one chalet in full for review', async () => {
    const res = await api
      .request()
      .get(api.url(`admin/chalets/${chaletId}`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(chaletId);
    expect(res.body.scheduling.defaultCleaningDurationMinutes).toBe(90);
    expect(res.body.minimumHourlyRate.amount).toBe(6_000);
    expect(Array.isArray(res.body.amenities)).toBe(true);
  });

  it('keeps a customer out of the review queue', async () => {
    await api
      .request()
      .get(api.url('admin/chalets'))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(403);
  });

  it('keeps an unauthenticated caller out entirely', async () => {
    await api.request().get(api.url('admin/chalets')).expect(401);
  });

  it('refuses a rejection with no reason', async () => {
    await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/approval`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ approve: false })
      .expect(422);
  });

  it('rejects with a reason the owner can act on', async () => {
    const res = await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/approval`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ approve: false, reason: 'الصور غير واضحة، أضف صورًا للمسبح والمدخل.' })
      .expect(200);

    expect(res.body.approvalStatus).toBe('REJECTED');
    expect(res.body.rejectionReason).toContain('الصور');
  });

  it('keeps a rejected chalet out of search', async () => {
    const res = await api.request().get(api.url('chalets')).expect(200);
    expect(res.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('approving makes the chalet bookable in the same write', async () => {
    const res = await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/approval`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ approve: true })
      .expect(200);

    expect(res.body.approvalStatus).toBe('APPROVED');
    expect(res.body.status).toBe('ACTIVE');
    // The old reason is cleared, or a fixed chalet would still show why it
    // was once refused.
    expect(res.body.rejectionReason).toBeNull();

    const search = await api.request().get(api.url('chalets')).expect(200);
    expect(search.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(true);
  });

  it('refuses to approve the same chalet twice', async () => {
    await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/approval`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ approve: true })
      .expect(409);
  });

  it('suspends a live chalet and takes it out of search', async () => {
    await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/suspension`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ suspend: true, reason: 'شكوى من ضيف قيد المراجعة' })
      .expect(200);

    const search = await api.request().get(api.url('chalets')).expect(200);
    expect(search.body.items.some((c: { id: string }) => c.id === chaletId)).toBe(false);
  });

  it('puts it back', async () => {
    const res = await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/suspension`))
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ suspend: false, reason: 'انتهت المراجعة' })
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('writes the decision to the audit log', async () => {
    const entries = await api.prisma.auditLog.findMany({
      where: { entityId: chaletId },
      select: { action: true },
    });
    expect(entries.map((e) => e.action)).toContain('chalet.approval');
    expect(entries.map((e) => e.action)).toContain('chalet.suspension');
  });

  it('does not let a customer approve anything', async () => {
    await api
      .request()
      .patch(api.url(`admin/chalets/${chaletId}/approval`))
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ approve: true })
      .expect(403);
  });
});
