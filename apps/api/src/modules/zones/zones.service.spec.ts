import { ZonesService } from './zones.service';

/**
 * `isOpen` is a pure function of the stored rows, so it is exercised directly rather than
 * through a Nest module. The constructor dependencies are never touched by it.
 */
const zones = new ZonesService(undefined as never, undefined as never, undefined as never);

type Row = { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean };
const row = (over: Partial<Row> = {}): Row => ({
  dayOfWeek: 0,
  opensAt: '06:00',
  closesAt: '00:00',
  isClosed: false,
  ...over,
});

/** Sunday, Asia/Jerusalem, at the given local time. */
const sundayAt = (hhmm: string): Date => new Date(`2026-09-06T${hhmm}:00+03:00`);
const TZ = 'Asia/Jerusalem';

describe('ZonesService.isOpen', () => {
  it('treats a day with no row as unrestricted', () => {
    expect(zones.isOpen([row({ dayOfWeek: 3 })], sundayAt('03:00'), TZ)).toBe(true);
  });

  it('honours an explicit closed day', () => {
    expect(zones.isOpen([row({ isClosed: true })], sundayAt('12:00'), TZ)).toBe(false);
  });

  it('opens on the opening minute and not the one before it', () => {
    expect(zones.isOpen([row()], sundayAt('05:59'), TZ)).toBe(false);
    expect(zones.isOpen([row()], sundayAt('06:00'), TZ)).toBe(true);
  });

  // The reason the seed writes '00:00' rather than '23:59': an exclusive '23:59' would
  // close the zone for the last minute of every day.
  it('keeps a 00:00 close open through 23:59 and shut after midnight', () => {
    expect(zones.isOpen([row()], sundayAt('23:59'), TZ)).toBe(true);
    expect(zones.isOpen([row({ dayOfWeek: 1 })], new Date('2026-09-07T00:00:00+03:00'), TZ)).toBe(
      false,
    );
    expect(zones.isOpen([row({ dayOfWeek: 1 })], new Date('2026-09-07T03:00:00+03:00'), TZ)).toBe(
      false,
    );
  });

  it('closes a minute early when 23:59 is used instead', () => {
    const legacy = [row({ closesAt: '23:59' })];
    expect(zones.isOpen(legacy, sundayAt('23:58'), TZ)).toBe(true);
    expect(zones.isOpen(legacy, sundayAt('23:59'), TZ)).toBe(false);
  });

  it('spans midnight for a genuine overnight window', () => {
    const overnight = [
      row({ opensAt: '20:00', closesAt: '02:00' }),
      row({ dayOfWeek: 1, opensAt: '20:00', closesAt: '02:00' }),
    ];
    expect(zones.isOpen(overnight, sundayAt('21:00'), TZ)).toBe(true);
    expect(zones.isOpen(overnight, new Date('2026-09-07T01:00:00+03:00'), TZ)).toBe(true);
    expect(zones.isOpen(overnight, new Date('2026-09-07T03:00:00+03:00'), TZ)).toBe(false);
  });

  it('reads the clock in the zone timezone, not the server one', () => {
    // 22:00 UTC is 01:00 the next day in Asia/Jerusalem, i.e. outside a 06:00-00:00 window.
    expect(zones.isOpen([row({ dayOfWeek: 1 })], new Date('2026-09-06T22:00:00Z'), TZ)).toBe(false);
    expect(zones.isOpen([row({ dayOfWeek: 0 })], new Date('2026-09-06T09:00:00Z'), TZ)).toBe(true);
  });
});
