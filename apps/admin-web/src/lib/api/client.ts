import { Headers as ApiHeaders, type ApiError as ApiErrorShape } from '@tamam/shared-types';

import { env } from '@/lib/env';
import { randomId } from '@/lib/utils/id';

import { ApiError } from './errors';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  /** Sent as `Idempotency-Key`; required by refund, dispute decision and similar routes. */
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the bearer token (public routes). */
  anonymous?: boolean;
  /** Return the raw Response instead of parsed JSON (file exports). */
  raw?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Current access token, or null when signed out. */
  getAccessToken: () => Promise<string | null> | string | null;
  /**
   * Obtain a fresh access token after a 401 (rotating refresh). Must resolve to null when the
   * session cannot be renewed; the client then calls `onUnauthenticated`.
   */
  refreshAccessToken: () => Promise<string | null>;
  onUnauthenticated?: () => void;
  getLanguage?: () => 'ar' | 'en';
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  get<T>(path: string, query?: QueryParams, options?: Omit<ApiRequestOptions, 'method' | 'query' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
  raw(path: string, options?: ApiRequestOptions): Promise<Response>;
}

export function buildQueryString(query: QueryParams | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item !== undefined && item !== null && item !== '') params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * `details` is either the field-error array from a validation failure or a free-form object.
 * The body is arbitrary JSON off the wire, so narrow it instead of asserting a shape: anything
 * that matches neither form is dropped rather than smuggled through as the wrong type.
 */
function narrowDetails(value: unknown): ApiErrorShape['details'] {
  if (Array.isArray(value)) {
    const isFieldError = (v: unknown): v is { field: string; message: string } =>
      typeof v === 'object' && v !== null && typeof (v as { field?: unknown }).field === 'string' && typeof (v as { message?: unknown }).message === 'string';
    return value.every(isFieldError) ? value : undefined;
  }
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

async function parseErrorBody(response: Response): Promise<Partial<ApiErrorShape> | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const body = parsed as { code?: unknown; message?: unknown; details?: unknown; requestId?: unknown };
    const details = narrowDetails(body.details);
    return {
      ...(typeof body.code === 'string' ? { code: body.code } : {}),
      ...(typeof body.message === 'string' ? { message: body.message } : {}),
      ...(details === undefined ? {} : { details }),
      ...(typeof body.requestId === 'string' ? { requestId: body.requestId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper implementing the platform conventions: base URL, bearer auth, `X-Request-Id`,
 * `Accept-Language`, `Idempotency-Key`, unified error shape and a **single-flight** refresh on 401
 * (many concurrent requests failing at once trigger exactly one refresh and are all retried once).
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  let refreshInFlight: Promise<string | null> | null = null;

  const refreshOnce = (): Promise<string | null> => {
    if (!refreshInFlight) {
      refreshInFlight = config
        .refreshAccessToken()
        .catch(() => null)
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  };

  const send = async (path: string, options: ApiRequestOptions, token: string | null, requestId: string): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      [ApiHeaders.REQUEST_ID]: requestId,
      [ApiHeaders.ACCEPT_LANGUAGE]: config.getLanguage?.() ?? 'ar',
      [ApiHeaders.TIMEZONE]: 'Asia/Jerusalem',
      ...options.headers,
    };
    if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;
    if (options.idempotencyKey) headers[ApiHeaders.IDEMPOTENCY_KEY] = options.idempotencyKey;
    const hasBody = options.body !== undefined && options.method !== 'GET';
    if (hasBody) headers['Content-Type'] = 'application/json';
    const init: RequestInit = { method: options.method ?? 'GET', headers, credentials: 'omit' };
    if (options.signal) init.signal = options.signal;
    if (hasBody) init.body = JSON.stringify(options.body);
    try {
      return await fetchImpl(`${config.baseUrl}${path}${buildQueryString(options.query)}`, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(0, { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Network error' }, requestId);
    }
  };

  const raw = async (path: string, options: ApiRequestOptions = {}): Promise<Response> => {
    const requestId = randomId();
    const token = options.anonymous ? null : await config.getAccessToken();
    let response = await send(path, options, token, requestId);
    if (response.status === 401 && !options.anonymous) {
      const fresh = await refreshOnce();
      if (!fresh) {
        config.onUnauthenticated?.();
        throw new ApiError(401, await parseErrorBody(response), requestId);
      }
      response = await send(path, options, fresh, requestId);
      if (response.status === 401) config.onUnauthenticated?.();
    }
    if (!response.ok) throw new ApiError(response.status, await parseErrorBody(response), requestId);
    return response;
  };

  const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const response = await raw(path, options);
    if (options.raw) return response as unknown as T;
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  };

  return {
    request,
    raw,
    get: (path, query, options) => request(path, { ...options, method: 'GET', query }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}

export const API_BASE_URL = env.apiBaseUrl;
