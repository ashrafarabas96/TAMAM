import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import type { SystemConfigService } from '../config/system-config.service';

import { AnalyticsService, isTrackedEvent, stripPii, zonedDateKey, zonedDayRange } from './analytics.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function harness() {
  const createMany = jest.fn(async (args: { data: unknown[] }) => ({ count: args.data.length }));
  const prisma = { analyticsEvent: { createMany } };
  const redis = { getJson: jest.fn(async () => null), setJson: jest.fn(async () => undefined) };
  const systemConfig = { getNumber: jest.fn(async () => 120) };
  const config = { env: { DEFAULT_TIMEZONE: 'Asia/Jerusalem', DEFAULT_CURRENCY: 'ILS' } };
  const service = new AnalyticsService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    systemConfig as unknown as SystemConfigService,
    config as unknown as AppConfigService,
  );
  return { service, createMany };
}

function user() {
  return { id: USER_ID, sessionId: 'session-1' } as never;
}

describe('isTrackedEvent', () => {
  it('accepts every whitelisted spec §117 event', () => {
    for (const name of [
      'app_opened',
      'service_selected',
      'job_created',
      'partner_assigned',
      'job_started',
      'job_completed',
      'job_cancelled',
      'quote_approved',
      'payment_success',
      'banner_impression',
      'banner_click',
      'search_performed',
      'screen_view',
    ]) {
      expect(isTrackedEvent(name)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isTrackedEvent('arbitrary_event')).toBe(false);
    expect(isTrackedEvent('APP_OPENED')).toBe(false);
    expect(isTrackedEvent('')).toBe(false);
  });
});

describe('stripPii', () => {
  it('removes phone, email, name and token keys', () => {
    expect(stripPii({ phone: '+970599123456', email: 'a@b.c', fullName: 'Sara', accessToken: 'x', categoryId: 'cat-1' })).toEqual({ categoryId: 'cat-1' });
  });

  it('is case-insensitive and matches substrings', () => {
    expect(stripPii({ PhoneNumber: '1', userEmail: '2', first_name: '3', refresh_token: '4', keep: 'yes' })).toEqual({ keep: 'yes' });
  });

  it('strips nested objects and arrays too', () => {
    expect(stripPii({ context: { name: 'Sara', screen: 'home' }, items: [{ email: 'x', sku: 'a' }] })).toEqual({
      context: { screen: 'home' },
      items: [{ sku: 'a' }],
    });
  });

  it('leaves primitive values untouched', () => {
    expect(stripPii({ count: 3, ok: true, label: 'ride' })).toEqual({ count: 3, ok: true, label: 'ride' });
  });

  it('stops recursing past the depth limit instead of looping forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(() => stripPii(deep)).not.toThrow();
    expect(stripPii(deep)).toEqual({ a: { b: { c: { d: {} } } } });
  });
});

describe('AnalyticsService.track', () => {
  it('persists only whitelisted events and reports the rest as rejected', async () => {
    const h = harness();
    const result = await h.service.track(
      user(),
      [
        { name: 'app_opened', occurredAt: '2026-05-20T10:00:00.000Z' },
        { name: 'definitely_not_a_real_event', occurredAt: '2026-05-20T10:00:01.000Z' },
        { name: 'screen_view', occurredAt: '2026-05-20T10:00:02.000Z' },
      ],
      'ios',
      '1.4.0',
    );
    expect(result).toEqual({ accepted: 2, rejected: 1 });
    const rows = h.createMany.mock.calls[0]?.[0].data as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(['app_opened', 'screen_view']);
  });

  it('strips PII from props before writing', async () => {
    const h = harness();
    await h.service.track(user(), [{ name: 'search_performed', occurredAt: '2026-05-20T10:00:00.000Z', props: { query: 'plumber', phone: '+970599123456' } }], 'android', null);
    const rows = h.createMany.mock.calls[0]?.[0].data as Array<{ props?: Record<string, unknown> }>;
    expect(rows[0]?.props).toEqual({ query: 'plumber' });
  });

  it('falls back to the authenticated session id and truncates long platform strings', async () => {
    const h = harness();
    await h.service.track(user(), [{ name: 'app_opened', occurredAt: '2026-05-20T10:00:00.000Z' }], 'a-very-long-platform-value', null);
    const rows = h.createMany.mock.calls[0]?.[0].data as Array<{ sessionId: string | null; platform: string | null }>;
    expect(rows[0]?.sessionId).toBe('session-1');
    expect(rows[0]?.platform).toHaveLength(10);
  });

  it('accepts anonymous events', async () => {
    const h = harness();
    const result = await h.service.track(null, [{ name: 'app_opened', occurredAt: '2026-05-20T10:00:00.000Z', sessionId: 'anon-session-1' }], 'web', null);
    expect(result.accepted).toBe(1);
    const rows = h.createMany.mock.calls[0]?.[0].data as Array<{ userId: string | null; sessionId: string | null }>;
    expect(rows[0]?.userId).toBeNull();
    expect(rows[0]?.sessionId).toBe('anon-session-1');
  });

  it('never touches the database when every event is dropped', async () => {
    const h = harness();
    const result = await h.service.track(user(), [{ name: 'nope', occurredAt: '2026-05-20T10:00:00.000Z' }], null, null);
    expect(result).toEqual({ accepted: 0, rejected: 1 });
    expect(h.createMany).not.toHaveBeenCalled();
  });
});

describe('zoned day helpers', () => {
  it('starts the local day at local midnight for a UTC+ timezone', () => {
    const { start, end } = zonedDayRange(new Date('2026-05-20T09:00:00.000Z'), 'Asia/Jerusalem');
    expect(start.toISOString()).toBe('2026-05-19T21:00:00.000Z'); // 2026-05-20 00:00 +03:00
    expect(end.toISOString()).toBe('2026-05-20T21:00:00.000Z');
  });

  it('matches UTC when the timezone is UTC', () => {
    const { start, end } = zonedDayRange(new Date('2026-05-20T09:00:00.000Z'), 'UTC');
    expect(start.toISOString()).toBe('2026-05-20T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-21T00:00:00.000Z');
  });

  it('keys the calendar day by local date, not by the UTC parts of the start instant', () => {
    expect(zonedDateKey(new Date('2026-05-20T09:00:00.000Z'), 'Asia/Jerusalem')).toBe('2026-05-20');
    expect(zonedDateKey(new Date('2026-05-19T22:00:00.000Z'), 'Asia/Jerusalem')).toBe('2026-05-20');
  });
});
