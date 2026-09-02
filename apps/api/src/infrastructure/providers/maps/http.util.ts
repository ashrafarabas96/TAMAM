import { AppException } from '../../../common/errors/app.exception';

/** fetch with timeout + JSON parse; every external call is bounded (spec §179). */
export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number; provider: string }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw AppException.external(init.provider, `${init.provider} responded ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AppException) throw err;
    throw AppException.external(init.provider, err instanceof Error ? err.message : 'request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** Retries idempotent GET calls a bounded number of times with jittered backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2, baseDelayMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1) + Math.random() * 100));
    }
  }
  throw lastErr;
}
