import { hmacHash, safeEqual } from '../../../common/utils/crypto.util';

/**
 * Tracking tokens bind a rendered banner to the viewer it was rendered for. Clients echo the
 * token back on impression/click/dismiss so ingestion can attribute the event without trusting
 * client-supplied banner ids (spec §82). The token is signed with the server pepper — it carries
 * no secret, so it is safe to hand to the app.
 *
 * Wire format: base64url("<bannerId>.<campaignId>.<subject>.<expEpochSeconds>.<hmac>").
 */

export interface BannerTokenPayload {
  bannerId: string;
  campaignId: string;
  /** User id, or `anon` for signed-out viewers. */
  subject: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

const SEPARATOR = '.';

function signature(payload: string, pepper: string): string {
  return hmacHash(payload, pepper);
}

export function signBannerToken(payload: BannerTokenPayload, pepper: string): string {
  const body = [payload.bannerId, payload.campaignId, payload.subject, String(payload.exp)].join(
    SEPARATOR,
  );
  return Buffer.from(`${body}${SEPARATOR}${signature(body, pepper)}`, 'utf8').toString('base64url');
}

/** Returns the payload when the signature is valid and the token has not expired, otherwise null. */
export function verifyBannerToken(
  token: string,
  pepper: string,
  now: Date,
): BannerTokenPayload | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split(SEPARATOR);
  if (parts.length !== 5) return null;
  const [bannerId, campaignId, subject, expRaw, sig] = parts;
  if (!bannerId || !campaignId || !subject || !expRaw || !sig) return null;

  const body = [bannerId, campaignId, subject, expRaw].join(SEPARATOR);
  if (!safeEqual(sig, signature(body, pepper))) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now.getTime()) return null;

  return { bannerId, campaignId, subject, exp };
}
