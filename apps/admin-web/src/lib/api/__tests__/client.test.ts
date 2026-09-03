import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import { ApiError } from '../errors';

interface FetchCall {
  url: string;
  init: RequestInit;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('api client', () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
  });

  const record = (impl: (call: FetchCall, index: number) => Response): typeof fetch =>
    (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = { url: String(input), init: init ?? {} };
      const index = calls.length;
      calls.push(call);
      return impl(call, index);
    }) as unknown as typeof fetch;

  it('sends bearer, request id, language and serialises the query string', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'token-1',
      refreshAccessToken: async () => null,
      getLanguage: () => 'ar',
      fetchImpl: record(() => jsonResponse({ items: [], nextCursor: null })),
    });
    await client.get('/admin/jobs', { status: 'SEARCHING', limit: 20, empty: '', skipped: undefined, tags: ['a', 'b'] });
    const call = calls[0]!;
    expect(call.url).toBe('https://api.test/api/v1/admin/jobs?status=SEARCHING&limit=20&tags=a&tags=b');
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers['Accept-Language']).toBe('ar');
    expect(headers['X-Request-Id']).toMatch(/.+/);
  });

  it('passes the Idempotency-Key header through', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 't', refreshAccessToken: async () => null, fetchImpl: record(() => jsonResponse({ ok: true })) });
    await client.post('/admin/refunds', { amountMinor: 100 }, { idempotencyKey: 'refund-123456789' });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('refund-123456789');
    expect(calls[0]!.init.body).toBe(JSON.stringify({ amountMinor: 100 }));
  });

  it('refreshes once on 401 and retries the request', async () => {
    const refresh = vi.fn(async () => 'token-2');
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 'token-1',
      refreshAccessToken: refresh,
      fetchImpl: record((call) => ((call.init.headers as Record<string, string>).Authorization === 'Bearer token-1' ? jsonResponse({ code: 'UNAUTHENTICATED' }, 401) : jsonResponse({ ok: true }))),
    });
    await expect(client.get('/me')).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('single-flights the refresh when several requests fail at once', async () => {
    let resolveRefresh: ((token: string) => void) | null = null;
    const refresh = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRefresh = resolve as (token: string) => void;
        }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 'stale',
      refreshAccessToken: refresh,
      fetchImpl: record((call) => ((call.init.headers as Record<string, string>).Authorization === 'Bearer stale' ? jsonResponse({ code: 'TOKEN_EXPIRED' }, 401) : jsonResponse({ ok: true }))),
    });
    const inflight = Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    resolveRefresh?.('fresh');
    await expect(inflight).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    // three initial 401s + three retries
    expect(calls).toHaveLength(6);
  });

  it('reports unauthenticated when the refresh fails', async () => {
    const onUnauthenticated = vi.fn();
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 'stale',
      refreshAccessToken: async () => null,
      onUnauthenticated,
      fetchImpl: record(() => jsonResponse({ code: 'TOKEN_REVOKED', message: 'gone', requestId: 'req-1' }, 401)),
    });
    await expect(client.get('/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('throws a typed ApiError carrying code, details and requestId', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 't',
      refreshAccessToken: async () => null,
      fetchImpl: record(() => jsonResponse({ code: 'VALIDATION_FAILED', message: 'Invalid', details: [{ field: 'name', message: 'required' }], requestId: 'req-42' }, 400)),
    });
    const error = await client.post('/admin/zones', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('VALIDATION_FAILED');
    expect(apiError.status).toBe(400);
    expect(apiError.requestId).toBe('req-42');
    expect(apiError.fieldErrors).toEqual([{ field: 'name', message: 'required' }]);
  });

  it('does not refresh for anonymous requests', async () => {
    const refresh = vi.fn(async () => 'token-2');
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: () => null, refreshAccessToken: refresh, fetchImpl: record(() => jsonResponse({ code: 'UNAUTHENTICATED' }, 401)) });
    await expect(client.get('/config/feature-flags', undefined, { anonymous: true })).rejects.toBeInstanceOf(ApiError);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('wraps network failures as an ApiError with code NETWORK_ERROR', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 't',
      refreshAccessToken: async () => null,
      fetchImpl: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
    });
    const error = (await client.get('/me').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
  });
});
