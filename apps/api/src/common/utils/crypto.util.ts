import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/** AES-256-GCM: returns base64(iv|tag|ciphertext). Used for PII at rest (spec §91). */
export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** HMAC-SHA256 with a server pepper — for OTP / PIN / token hashing (never store plaintext). */
export function hmacHash(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Cryptographically random numeric code of `length` digits (no leading-zero bias issues). */
export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String(randomInt(0, 10));
  return out;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Short human-friendly code without ambiguous characters (referral codes). */
export function randomReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

/** Masks a phone for display: +970599123456 → +970 59 *** *456 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '***';
  return `${phone.slice(0, 6)}***${phone.slice(-3)}`;
}
