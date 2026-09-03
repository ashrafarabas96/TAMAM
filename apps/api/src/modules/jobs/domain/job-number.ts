/** Human-readable job number: TM-YYMM-NNNNNN (spec §137/§139 search by number). */
export function formatJobNumber(seq: bigint, at = new Date()): string {
  const yy = String(at.getUTCFullYear()).slice(-2);
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `TM-${yy}${mm}-${String(seq).padStart(6, '0')}`;
}
