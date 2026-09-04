export const nowUtc = (): Date => new Date();
export const addSeconds = (d: Date, s: number): Date => new Date(d.getTime() + s * 1000);
export const addMinutes = (d: Date, m: number): Date => new Date(d.getTime() + m * 60_000);
export const addHours = (d: Date, h: number): Date => new Date(d.getTime() + h * 3_600_000);
export const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);
export const secondsBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / 1000);
export const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** "HH:mm" in a given IANA timezone. */
export function localTime(d: Date, timeZone: string): { hhmm: string; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    hhmm: `${hour === '24' ? '00' : hour}:${minute}`,
    dayOfWeek: Math.max(0, days.indexOf(weekday)),
  };
}
