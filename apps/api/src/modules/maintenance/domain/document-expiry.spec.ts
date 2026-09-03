import { DOCUMENT_EXPIRY_WARNING_DAYS, type ExpiringDocument, dayMs, daysUntil, documentsToExpire, documentsToWarn } from './document-expiry';

const NOW = new Date('2026-09-03T12:00:00.000Z');
const inDays = (days: number): Date => new Date(NOW.getTime() + days * dayMs);

function doc(overrides: Partial<ExpiringDocument> = {}): ExpiringDocument {
  return {
    id: 'doc-1',
    partnerId: 'partner-1',
    type: 'ID',
    status: 'APPROVED',
    expiresAt: inDays(5),
    expiryNotifiedAt: null,
    ...overrides,
  };
}

describe('document expiry rules', () => {
  describe('documentsToWarn', () => {
    it('warns about a document expiring inside the window', () => {
      const d = doc({ expiresAt: inDays(3) });
      expect(documentsToWarn([d], NOW)).toEqual([d]);
    });

    it('includes the last day of the window and excludes the day after', () => {
      const inside = doc({ id: 'inside', expiresAt: inDays(DOCUMENT_EXPIRY_WARNING_DAYS) });
      const outside = doc({ id: 'outside', expiresAt: inDays(DOCUMENT_EXPIRY_WARNING_DAYS + 1) });
      expect(documentsToWarn([inside, outside], NOW).map((d) => d.id)).toEqual(['inside']);
    });

    it('never warns twice — expiryNotifiedAt is the idempotency marker', () => {
      expect(documentsToWarn([doc({ expiryNotifiedAt: new Date('2026-09-01T00:00:00.000Z') })], NOW)).toEqual([]);
    });

    it('ignores documents without an expiry date', () => {
      expect(documentsToWarn([doc({ expiresAt: null })], NOW)).toEqual([]);
    });

    it('ignores already expired or rejected documents', () => {
      expect(documentsToWarn([doc({ expiresAt: inDays(-1) })], NOW)).toEqual([]);
      expect(documentsToWarn([doc({ status: 'EXPIRED', expiresAt: inDays(2) })], NOW)).toEqual([]);
      expect(documentsToWarn([doc({ status: 'REJECTED', expiresAt: inDays(2) })], NOW)).toEqual([]);
    });

    it('warns about pending documents too — they still block going online once lapsed', () => {
      expect(documentsToWarn([doc({ status: 'PENDING', expiresAt: inDays(4) })], NOW)).toHaveLength(1);
    });

    it('honours a custom warning window', () => {
      expect(documentsToWarn([doc({ expiresAt: inDays(20) })], NOW, 30)).toHaveLength(1);
      expect(documentsToWarn([doc({ expiresAt: inDays(20) })], NOW, 7)).toHaveLength(0);
    });
  });

  describe('documentsToExpire', () => {
    it('flags a document whose date has passed', () => {
      const d = doc({ expiresAt: inDays(-1) });
      expect(documentsToExpire([d], NOW)).toEqual([d]);
    });

    it('leaves documents that expire later alone', () => {
      expect(documentsToExpire([doc({ expiresAt: inDays(1) })], NOW)).toEqual([]);
    });

    it('is idempotent: already EXPIRED rows are not re-flagged', () => {
      expect(documentsToExpire([doc({ status: 'EXPIRED', expiresAt: inDays(-3) })], NOW)).toEqual([]);
    });

    it('does not resurrect rejected documents', () => {
      expect(documentsToExpire([doc({ status: 'REJECTED', expiresAt: inDays(-3) })], NOW)).toEqual([]);
    });

    it('ignores documents without an expiry date', () => {
      expect(documentsToExpire([doc({ expiresAt: null })], NOW)).toEqual([]);
    });
  });

  describe('daysUntil', () => {
    it('rounds up partial days', () => {
      expect(daysUntil(new Date(NOW.getTime() + 1.2 * dayMs), NOW)).toBe(2);
      expect(daysUntil(new Date(NOW.getTime() + 3 * dayMs), NOW)).toBe(3);
    });

    it('never returns a negative number', () => {
      expect(daysUntil(new Date(NOW.getTime() - 5 * dayMs), NOW)).toBe(0);
    });
  });
});
