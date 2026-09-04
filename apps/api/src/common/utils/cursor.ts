import type { Page } from '@tamam/shared-types';

import { AppException } from '../errors/app.exception';

export interface CursorPayload {
  createdAt: string;
  id: string;
}

/** Opaque keyset cursor (createdAt desc, id desc) — stable under inserts, no OFFSET scans. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string')
      throw new Error('bad cursor');
    if (Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('bad cursor');
    return parsed;
  } catch {
    throw AppException.validation([{ field: 'cursor', message: 'invalid cursor' }]);
  }
}

/** Builds a page from `limit + 1` rows fetched in (createdAt desc, id desc) order. */
export function buildPage<T extends { id: string; createdAt: Date }, R>(
  rows: T[],
  limit: number,
  map: (row: T) => R,
): Page<R> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  return {
    items: slice.map(map),
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

/** Prisma `where` fragment for keyset pagination on (createdAt, id). */
export function cursorWhere(cursor: CursorPayload | null): Record<string, unknown> {
  if (!cursor) return {};
  const at = new Date(cursor.createdAt);
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }] };
}
