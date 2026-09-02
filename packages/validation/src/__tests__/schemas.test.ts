import { describe, expect, it } from 'vitest';

import { bannerSchema, createJobSchema, phoneSchema, requestOtpSchema, updateConfigSchema, upsertPromoCodeSchema } from '../index';

describe('phoneSchema', () => {
  it('accepts E.164', () => {
    expect(phoneSchema.safeParse('+970599123456').success).toBe(true);
    expect(phoneSchema.safeParse('+972501234567').success).toBe(true);
  });
  it('rejects local formats', () => {
    expect(phoneSchema.safeParse('0599123456').success).toBe(false);
    expect(phoneSchema.safeParse('+0599').success).toBe(false);
  });
});

describe('requestOtpSchema', () => {
  it('defaults audience and language', () => {
    const r = requestOtpSchema.parse({ phone: '+970599123456' });
    expect(r.audience).toBe('CUSTOMER');
    expect(r.language).toBe('ar');
  });
});

describe('createJobSchema', () => {
  const addr = { lat: 31.9, lng: 35.2, formatted: 'Ramallah' };
  it('validates a ride', () => {
    const r = createJobSchema.safeParse({
      type: 'RIDE',
      estimateId: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f',
      vehicleTypeId: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f',
      paymentMethod: 'CASH',
      pickup: addr,
      destination: addr,
    });
    expect(r.success).toBe(true);
  });
  it('requires description for home services', () => {
    const r = createJobSchema.safeParse({
      type: 'HOME_SERVICE',
      estimateId: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f',
      paymentMethod: 'CASH',
      location: addr,
      categoryId: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f',
    });
    expect(r.success).toBe(false);
  });
});

describe('bannerSchema', () => {
  const creative = { imageMediaId: { ar: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f', en: '2c9f7a3e-1a4b-4c3d-9e8f-0a1b2c3d4e5f' } };
  it('requires https for external urls', () => {
    expect(bannerSchema.safeParse({ placement: 'HOME_HERO', creative, actionType: 'EXTERNAL_URL', actionValue: 'http://x.com' }).success).toBe(false);
    expect(bannerSchema.safeParse({ placement: 'HOME_HERO', creative, actionType: 'EXTERNAL_URL', actionValue: 'https://x.com' }).success).toBe(true);
  });
  it('validates deep link scheme', () => {
    expect(bannerSchema.safeParse({ placement: 'HOME_HERO', creative, actionType: 'DEEP_LINK', actionValue: 'tamam://services/plumbing' }).success).toBe(true);
    expect(bannerSchema.safeParse({ placement: 'HOME_HERO', creative, actionType: 'DEEP_LINK', actionValue: 'evil://x' }).success).toBe(false);
  });
});

describe('updateConfigSchema', () => {
  it('rejects out of range values', () => {
    expect(updateConfigSchema.safeParse({ key: 'commission.default_percent', value: 100, reason: 'test' }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ key: 'commission.default_percent', value: 20, reason: 'test' }).success).toBe(true);
  });
  it('rejects unknown keys', () => {
    expect(updateConfigSchema.safeParse({ key: 'nope', value: 1, reason: 'test' }).success).toBe(false);
  });
});

describe('upsertPromoCodeSchema', () => {
  it('caps percentage at 100', () => {
    const base = { code: 'WELCOME', type: 'PERCENTAGE', currency: 'ILS', startsAt: '2026-01-01T00:00:00Z' };
    expect(upsertPromoCodeSchema.safeParse({ ...base, value: 120 }).success).toBe(false);
    expect(upsertPromoCodeSchema.safeParse({ ...base, value: 20 }).success).toBe(true);
  });
});
