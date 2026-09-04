import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as sharedEnums from '@tamam/shared-types';

/**
 * The Prisma schema and @tamam/shared-types describe the same vocabulary twice:
 * once for PostgreSQL, once for the API, Admin and (via the Dart generator) both
 * Flutter apps. A value added on one side and forgotten on the other used to be
 * found by hand, and once it was found six times at once. This reads both sides
 * and fails the build instead.
 */

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

/** `enum ChaletBookingStatus { DRAFT HELD ... @@map("chalet_booking_status") }` */
function readPrismaEnums(source: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const block = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(source)) !== null) {
    const [, name, body] = match;
    if (name === undefined || body === undefined) continue;
    const values = body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => /^[A-Za-z][A-Za-z0-9_]*$/.test(line));
    out.set(name, values);
  }
  return out;
}

/** The `export const X = { A: 'A' } as const` objects, which is what the Dart generator reads too. */
function readSharedEnums(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [name, value] of Object.entries(sharedEnums as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length || !entries.every(([, v]) => typeof v === 'string')) continue;
    out.set(name, entries.map(([, v]) => v as string));
  }
  return out;
}

const prismaEnums = readPrismaEnums(schema);
const shared = readSharedEnums();

/**
 * Enums Prisma owns that deliberately have no shared-types twin: they never
 * cross the wire, so mirroring them would be dead vocabulary in three languages.
 */
const PRISMA_ONLY = new Set<string>(['ChaletRateRuleKind']);

/**
 * A few live in shared-types as a readonly array rather than a const object,
 * because the values are also keys into another file — BannerTheme's are the
 * theme names in packages/ui-tokens/tokens.json. Same vocabulary, different shape.
 */
const ARRAY_SHAPED: Record<string, readonly string[]> = {
  BannerTheme: sharedEnums.BANNER_THEMES,
};
for (const [name, values] of Object.entries(ARRAY_SHAPED)) shared.set(name, [...values]);

describe('shared-types mirrors schema.prisma', () => {
  it('parses both sides', () => {
    expect(prismaEnums.size).toBeGreaterThan(30);
    expect(shared.size).toBeGreaterThan(20);
  });

  const paired = [...prismaEnums.keys()].filter((name) => shared.has(name));

  it('pairs every Prisma enum that is not deliberately backend-only', () => {
    const unpaired = [...prismaEnums.keys()].filter(
      (name) => !shared.has(name) && !PRISMA_ONLY.has(name),
    );
    expect(unpaired).toEqual([]);
  });

  it.each(paired)('%s has the same values on both sides', (name) => {
    const fromPrisma = [...(prismaEnums.get(name) ?? [])].sort();
    const fromShared = [...(shared.get(name) ?? [])].sort();
    expect(fromShared).toEqual(fromPrisma);
  });
});

describe('the slot-holding statuses match the database constraint', () => {
  /**
   * CHALET_SLOT_HOLDING_STATUSES is what the availability engine filters by;
   * the WHERE clause of chalet_bookings_no_overlap is what the database enforces.
   * If they ever disagree, a booking is either invisible to search or able to
   * overlap one. They are written in two languages, so they are compared here.
   */
  const sql = readFileSync(join(__dirname, '../../../prisma/sql/002_chalet.sql'), 'utf8');

  it('lists exactly the statuses the exclusion constraint covers', () => {
    const constraint =
      /ADD CONSTRAINT chalet_bookings_no_overlap[\s\S]*?WHERE \(status IN \(([^)]*)\)\)/.exec(sql);
    const listed = constraint?.[1];
    expect(listed).toBeDefined();
    const inSql = [...(listed ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...sharedEnums.CHALET_SLOT_HOLDING_STATUSES].sort());
  });

  it('accounts for every booking status exactly once', () => {
    const holding = new Set<string>(sharedEnums.CHALET_SLOT_HOLDING_STATUSES);
    const terminal = new Set<string>(sharedEnums.CHALET_TERMINAL_STATUSES);
    const unaccounted = Object.values(sharedEnums.ChaletBookingStatus).filter(
      (s) => !holding.has(s) && !terminal.has(s),
    );
    // DRAFT holds nothing and is not over; DISPUTED keeps a finished booking open
    // for support without re-blocking the calendar.
    expect(unaccounted.sort()).toEqual(['DISPUTED', 'DRAFT']);
    expect([...holding].filter((s) => terminal.has(s))).toEqual([]);
  });
});
