import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Observable, map } from 'rxjs';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Makes responses JSON-safe: BigInt → number (money minor units never exceed 2^53 in
 * practice; we throw loudly if they would), Prisma Decimal → number, Date → ISO string.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    if (value > MAX_SAFE || value < -MAX_SAFE)
      throw new Error('BigInt exceeds JS safe integer range');
    return Number(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toJsonSafe(data)));
  }
}
