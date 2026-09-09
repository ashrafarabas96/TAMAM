import { randomUUID } from 'node:crypto';

import type { FareEstimateDto, ServiceCategoryDto, ServiceTypeDto } from '@tamam/shared-types';
import type { UpsertServiceCategoryInput } from '@tamam/validation';

import { type AuthContext, RAMALLAH, SEED, TestApp } from './helpers/app';

/**
 * Spec §82 — the console owns the catalogue: which top-level services exist,
 * and how each service category may be asked for (now, at a later time, at
 * which urgency). What matters is that a change made in the console is what
 * the apps see next, and that the server holds the rule when a client does not.
 */
describe('Service catalogue control (§82)', () => {
  let api: TestApp;
  let admin: AuthContext;
  let customer: AuthContext;
  let subject: ServiceTypeDto;
  let plumbing: ServiceCategoryDto;

  const location = {
    lat: RAMALLAH.lat + 0.004,
    lng: RAMALLAH.lng + 0.003,
    formatted: 'رام الله — حي الطيرة، عمارة 12',
    city: 'Ramallah',
  };

  /** The console's edit form sends the whole category back; mirror that here. */
  const asInput = (c: ServiceCategoryDto): UpsertServiceCategoryInput => ({
    serviceTypeId: c.serviceTypeId,
    slug: c.slug,
    name: c.name,
    description: c.description,
    // The DTO carries resolved URLs, not media ids; the seed sets neither.
    iconMediaId: null,
    imageMediaId: null,
    colorHex: c.colorHex,
    pricingMethod: c.pricingMethod,
    requiredPartnerRole: c.requiredPartnerRole,
    requiredDocumentTypes: c.requiredDocumentTypes,
    requiredFields: c.requiredFields,
    requiredMedia: c.requiredMedia,
    allowsInstant: c.allowsInstant,
    allowsScheduled: c.allowsScheduled,
    urgencyLevels: c.urgencyLevels,
    inspectionFee: c.inspectionFee,
    startingFrom: c.startingFrom,
    hourlyRate: c.hourlyRate,
    fixedPrice: c.fixedPrice,
    workflowConfig: c.workflowConfig,
    zoneIds: c.zoneIds,
    isFeatured: c.isFeatured,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  });

  beforeAll(async () => {
    api = await TestApp.boot();
    await api.truncateOperationalTables();
    admin = await api.loginAdmin();
    customer = await api.loginCustomer(SEED.customerPhone);

    const types = (
      await api.request().get(api.url('admin/catalog/service-types')).set(admin.headers).expect(200)
    ).body as ServiceTypeDto[];
    // Any service the other suites do not drive; the seed always ships more than three.
    subject =
      types.find((t) => !['RIDE', 'DELIVERY', 'HOME_SERVICE'].includes(t.code)) ??
      types[types.length - 1]!;

    const categories = (
      await api.request().get(api.url('admin/catalog/categories')).set(admin.headers).expect(200)
    ).body as ServiceCategoryDto[];
    plumbing = categories.find((c) => c.slug === 'plumbing')!;
    expect(plumbing).toBeDefined();
  }, 180_000);

  afterAll(async () => {
    // Leave the catalogue as the seed made it for the suites that follow.
    if (api && subject) {
      await api
        .request()
        .put(api.url(`admin/catalog/service-types/${subject.id}`))
        .set(admin.headers)
        .send({
          name: subject.name,
          description: subject.description,
          iconMediaId: null,
          colorHex: subject.colorHex,
          sortOrder: subject.sortOrder,
          isActive: subject.isActive,
        });
    }
    if (api && plumbing) {
      await api
        .request()
        .put(api.url(`admin/catalog/categories/${plumbing.id}`))
        .set(admin.headers)
        .send(asInput(plumbing));
    }
    await api?.close();
  });

  it('lets the operator rename, recolour and switch a top-level service off, and the app stops offering it', async () => {
    const renamed = (
      await api
        .request()
        .put(api.url(`admin/catalog/service-types/${subject.id}`))
        .set(admin.headers)
        .send({
          name: { ar: 'خدمة موقوفة مؤقتاً', en: 'Paused service' },
          description: null,
          iconMediaId: null,
          colorHex: '#123456',
          sortOrder: 99,
          isActive: false,
        })
        .expect(200)
    ).body as ServiceTypeDto;
    expect(renamed.name.ar).toBe('خدمة موقوفة مؤقتاً');
    expect(renamed.colorHex).toBe('#123456');
    expect(renamed.isActive).toBe(false);

    // The console still sees it, switched off…
    const adminList = (
      await api.request().get(api.url('admin/catalog/service-types')).set(admin.headers).expect(200)
    ).body as ServiceTypeDto[];
    expect(adminList.find((t) => t.id === subject.id)?.isActive).toBe(false);

    // …and the customer app no longer does.
    const publicList = (
      await api.request().get(api.url('catalog/service-types')).set(customer.headers).expect(200)
    ).body as ServiceTypeDto[];
    expect(publicList.some((t) => t.id === subject.id)).toBe(false);
  });

  it('keeps the service catalogue behind SERVICES_MANAGE', async () => {
    await api
      .request()
      .put(api.url(`admin/catalog/service-types/${subject.id}`))
      .set(customer.headers)
      .send({ name: subject.name, colorHex: subject.colorHex, sortOrder: 0, isActive: true })
      .expect(403);
  });

  it('refuses an instant request for a category the operator marked schedule-only', async () => {
    await api
      .request()
      .put(api.url(`admin/catalog/categories/${plumbing.id}`))
      .set(admin.headers)
      .send({ ...asInput(plumbing), allowsInstant: false, allowsScheduled: true })
      .expect(200);

    // Asking for a price "now" is already refused at the estimate…
    const refused = await api
      .request()
      .post(api.url('estimates/service'))
      .set(customer.headers)
      .send({ location, categoryId: plumbing.id, urgency: 'STANDARD', optionIds: [] })
      .expect(422);
    expect(
      (refused.body as { details: Array<{ field: string }> }).details.some(
        (d) => d.field === 'scheduledFor',
      ),
    ).toBe(true);

    // …and a client that priced a scheduled visit cannot then submit it as "now".
    const scheduledFor = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const estimate = (
      await api
        .request()
        .post(api.url('estimates/service'))
        .set(customer.headers)
        .send({
          location,
          categoryId: plumbing.id,
          urgency: 'STANDARD',
          optionIds: [],
          scheduledFor,
        })
        .expect(201)
    ).body as FareEstimateDto;

    const res = await api
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
        categoryId: plumbing.id,
        optionIds: [],
        mediaIds: [],
        urgency: 'STANDARD',
        description: 'يوجد تسريب مياه أسفل مغسلة المطبخ منذ يومين.',
        dynamicFields: { leak_location: 'kitchen', urgency_note: 'this_week' },
      })
      .expect(422);
    const details = (res.body as { details: Array<{ field: string }> }).details;
    expect(details.some((d) => d.field === 'scheduling')).toBe(true);
  });
});
