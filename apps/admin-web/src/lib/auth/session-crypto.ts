import { EncryptJWT, jwtDecrypt } from 'jose';

/**
 * Session payload stored in the httpOnly cookie. Encrypted (JWE, A256GCM) so the browser and any
 * intermediary only ever see ciphertext; the refresh token never leaves the server side.
 */
export interface SessionPayload {
  userId: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  /** ISO timestamps. */
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

const ISSUER = 'tamam-admin-web';

async function deriveKey(secret: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

export async function sealSession(payload: SessionPayload, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const expires = Math.floor(new Date(payload.refreshExpiresAt).getTime() / 1000);
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(expires)
    .encrypt(key);
}

export async function openSession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const key = await deriveKey(secret);
    const { payload } = await jwtDecrypt(token, key, { issuer: ISSUER });
    const p = payload as Partial<SessionPayload>;
    if (
      !p.userId ||
      !p.deviceId ||
      !p.accessToken ||
      !p.refreshToken ||
      !p.accessExpiresAt ||
      !p.refreshExpiresAt
    )
      return null;
    return {
      userId: p.userId,
      deviceId: p.deviceId,
      accessToken: p.accessToken,
      refreshToken: p.refreshToken,
      accessExpiresAt: p.accessExpiresAt,
      refreshExpiresAt: p.refreshExpiresAt,
    };
  } catch {
    return null;
  }
}
