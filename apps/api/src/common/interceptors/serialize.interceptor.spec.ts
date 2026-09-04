import { Prisma } from '@prisma/client';

import { toJsonSafe } from './serialize.interceptor';

/**
 * Every response passes through this function (registered as a global APP_INTERCEPTOR), so it
 * is the whole API's numeric wire contract: a client never has to accept `number | string` for
 * a money or ratio field, whether the route returns a mapped DTO or a raw Prisma row.
 */
describe('toJsonSafe', () => {
  it('passes primitives and nullish values through untouched', () => {
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe(undefined)).toBeUndefined();
    expect(toJsonSafe('ILS')).toBe('ILS');
    expect(toJsonSafe(42)).toBe(42);
    expect(toJsonSafe(true)).toBe(true);
  });

  it('renders BigInt minor units as numbers', () => {
    expect(toJsonSafe(1234n)).toBe(1234);
    expect(toJsonSafe(0n)).toBe(0);
    expect(toJsonSafe(-500n)).toBe(-500);
  });

  it('refuses a BigInt that JSON could not represent exactly', () => {
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => toJsonSafe(tooBig)).toThrow('BigInt exceeds JS safe integer range');
    expect(() => toJsonSafe(-tooBig)).toThrow('BigInt exceeds JS safe integer range');
    expect(toJsonSafe(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('renders Prisma Decimal as a number, never a string', () => {
    expect(toJsonSafe(new Prisma.Decimal('1.75'))).toBe(1.75);
    expect(toJsonSafe(new Prisma.Decimal('31.90381'))).toBeCloseTo(31.90381, 5);
  });

  it('renders dates as ISO strings', () => {
    expect(toJsonSafe(new Date('2026-09-04T10:00:00.000Z'))).toBe('2026-09-04T10:00:00.000Z');
  });

  it('walks arrays and nested objects, including a raw row shape', () => {
    const row = {
      id: 'rule-1',
      multiplier: new Prisma.Decimal('1.50'),
      feeBeforeArrivalMinor: 500n,
      createdAt: new Date('2026-09-04T10:00:00.000Z'),
      nested: { lat: new Prisma.Decimal('31.9'), tags: ['a', 'b'], amounts: [1n, 2n] },
    };
    expect(toJsonSafe(row)).toEqual({
      id: 'rule-1',
      multiplier: 1.5,
      feeBeforeArrivalMinor: 500,
      createdAt: '2026-09-04T10:00:00.000Z',
      nested: { lat: 31.9, tags: ['a', 'b'], amounts: [1, 2] },
    });
  });

  it('survives a paginated envelope', () => {
    expect(toJsonSafe({ items: [{ amountMinor: 12n }], nextCursor: null })).toEqual({
      items: [{ amountMinor: 12 }],
      nextCursor: null,
    });
  });
});
