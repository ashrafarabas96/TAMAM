import { Prisma } from '@prisma/client';

import type { SeedContext } from './context';

export interface ZoneSeedResult {
  /** Zone id by code (RAMALLAH, NABLUS, HEBRON). */
  zoneIds: Map<string, string>;
  centers: Map<string, { lat: number; lng: number }>;
}

const KM_PER_DEGREE_LAT = 111.32;

/**
 * Builds a closed, deterministic, slightly irregular ring around a centre. Real municipal
 * boundaries are not public domain data we can vendor, so the seed ships plausible service
 * areas (~6–9 km across) that an operator replaces from the admin zone editor.
 */
function ring(centerLat: number, centerLng: number, radiiKm: number[]): number[][] {
  const lngScale = Math.cos((centerLat * Math.PI) / 180);
  const points = radiiKm.map((radiusKm, index) => {
    const angle = (2 * Math.PI * index) / radiiKm.length;
    const dLat = (radiusKm / KM_PER_DEGREE_LAT) * Math.cos(angle);
    const dLng = (radiusKm / (KM_PER_DEGREE_LAT * lngScale)) * Math.sin(angle);
    return [Number((centerLng + dLng).toFixed(6)), Number((centerLat + dLat).toFixed(6))];
  });
  const first = points[0];
  if (!first) throw new Error('ring needs at least one vertex');
  return [...points, [first[0] as number, first[1] as number]];
}

interface ZoneSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  city: string;
  lat: number;
  lng: number;
  /** One radius per vertex, walked clockwise from due north — 12 vertices. */
  radiiKm: number[];
}

const ZONES: ZoneSeed[] = [
  {
    code: 'RAMALLAH',
    nameAr: 'رام الله والبيرة',
    nameEn: 'Ramallah & Al-Bireh',
    city: 'Ramallah',
    lat: 31.9038,
    lng: 35.2034,
    radiiKm: [4.6, 5.4, 6.1, 5.8, 4.9, 4.2, 4.7, 5.6, 6.3, 5.9, 5.1, 4.4],
  },
  {
    code: 'NABLUS',
    nameAr: 'نابلس',
    nameEn: 'Nablus',
    city: 'Nablus',
    lat: 32.2211,
    lng: 35.2544,
    radiiKm: [5.2, 4.6, 4.1, 4.8, 5.7, 6.4, 6.0, 5.2, 4.5, 4.0, 4.6, 5.5],
  },
  {
    code: 'HEBRON',
    nameAr: 'الخليل',
    nameEn: 'Hebron',
    city: 'Hebron',
    lat: 31.5326,
    lng: 35.0998,
    radiiKm: [5.8, 6.4, 6.0, 5.3, 4.7, 4.3, 4.8, 5.5, 6.2, 6.5, 5.9, 5.1],
  },
];

/** 06:00 → midnight every day. `closesAt` is exclusive and '00:00' is the next midnight,
 * so the zone stays open through 23:59 rather than closing a minute early. */
const OPENS_AT = '06:00';
const CLOSES_AT = '00:00';

export async function seedZones(ctx: SeedContext): Promise<ZoneSeedResult> {
  const { prisma, summary, currency, timezone } = ctx;
  const zoneIds = new Map<string, string>();
  const centers = new Map<string, { lat: number; lng: number }>();

  for (const zone of ZONES) {
    const polygon = { type: 'Polygon', coordinates: [ring(zone.lat, zone.lng, zone.radiiKm)] };
    const data = {
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      city: zone.city,
      currency,
      timezone,
      polygonGeoJson: polygon as unknown as Prisma.InputJsonValue,
      // The trg_sync_zone_area trigger recomputes both from the polygon; these are the NOT NULL seeds.
      centerLat: new Prisma.Decimal(zone.lat),
      centerLng: new Prisma.Decimal(zone.lng),
      isActive: true,
    };
    const row = await prisma.serviceZone.upsert({
      where: { code: zone.code },
      update: data,
      create: { code: zone.code, ...data },
    });
    zoneIds.set(zone.code, row.id);
    centers.set(zone.code, { lat: zone.lat, lng: zone.lng });

    await prisma.zoneOperatingHours.deleteMany({ where: { zoneId: row.id, ruleId: null } });
    await prisma.zoneOperatingHours.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        zoneId: row.id,
        dayOfWeek,
        opensAt: OPENS_AT,
        closesAt: CLOSES_AT,
        isClosed: false,
      })),
    });
  }

  summary.set('service zones', ZONES.length);
  summary.note(`zones open ${OPENS_AT}–${CLOSES_AT} every day, ${timezone}`);
  return { zoneIds, centers };
}
