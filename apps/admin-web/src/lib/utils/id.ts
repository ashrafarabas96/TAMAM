/** Stable, browser-safe device identifier for the admin session (stored per browser). */
const DEVICE_ID_KEY = 'tamam_admin_device_id';

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return randomId();
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const created = randomId();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}
