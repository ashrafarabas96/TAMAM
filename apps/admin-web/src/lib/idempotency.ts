import { randomId } from '@/lib/utils/id';

/**
 * Idempotency keys are generated once per user intent (e.g. when a confirm dialog opens) and
 * reused for retries of the same intent, so a double click or a network retry never issues a
 * refund twice. Keys must be 8–128 characters (spec: `idempotencyKeySchema`).
 */
export function createIdempotencyKey(scope: string): string {
  const key = `${scope}-${randomId()}`;
  return key.length > 128 ? key.slice(0, 128) : key;
}
