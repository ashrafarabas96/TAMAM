import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * A 40-line PNG encoder — enough to emit solid-colour placeholders for the development seed
 * without adding a dependency. Only what the format needs: IHDR (8-bit truecolour), one
 * zlib-deflated IDAT and IEND.
 */

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const TAMAM_PURPLE: Rgb = { r: 0x5d, g: 0x3e, b: 0xbc };
export const TAMAM_YELLOW: Rgb = { r: 0xff, g: 0xd3, b: 0x00 };
export const TAMAM_GREY: Rgb = { r: 0xf4, g: 0xf4, b: 0xf6 };

/**
 * Solid rectangle with an optional horizontal accent band (so the three seeded banners are
 * visually distinguishable in the app without shipping binary assets in git).
 */
export function solidPng(width: number, height: number, background: Rgb, accent?: Rgb): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const bandStart = Math.floor(height * 0.72);
  const bandEnd = Math.floor(height * 0.86);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;
    const colour = accent && y >= bandStart && y < bandEnd ? accent : background;
    for (let x = 0; x < width; x += 1) {
      raw[offset] = colour.r;
      raw[offset + 1] = colour.g;
      raw[offset + 2] = colour.b;
      offset += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface GeneratedAsset {
  /** Path relative to the seed-assets directory, e.g. `banners/home-hero-ar.png`. */
  relativePath: string;
  /** Object key the MediaAsset row points at. */
  objectKey: string;
  bucket: 'public' | 'private';
  width: number;
  height: number;
  bytes: number;
}

/** The placeholder creatives the seed references. `scripts/seed-assets.sh` uploads them. */
export const SEED_ASSET_SPECS = [
  {
    relativePath: 'banners/home-hero-ar.png',
    objectKey: 'seed/banners/home-hero-ar.png',
    bucket: 'public' as const,
    width: 1200,
    height: 600,
    background: TAMAM_PURPLE,
    accent: TAMAM_YELLOW,
  },
  {
    relativePath: 'banners/home-hero-en.png',
    objectKey: 'seed/banners/home-hero-en.png',
    bucket: 'public' as const,
    width: 1200,
    height: 600,
    background: TAMAM_PURPLE,
    accent: TAMAM_YELLOW,
  },
  {
    relativePath: 'banners/home-inline.png',
    objectKey: 'seed/banners/home-inline.png',
    bucket: 'public' as const,
    width: 1000,
    height: 320,
    background: TAMAM_YELLOW,
    accent: TAMAM_PURPLE,
  },
  {
    relativePath: 'documents/placeholder.png',
    objectKey: 'seed/documents/placeholder.png',
    bucket: 'private' as const,
    width: 800,
    height: 1000,
    background: TAMAM_GREY,
    accent: TAMAM_PURPLE,
  },
];

/** Writes every placeholder into `dir` (created if missing) and returns their metadata. */
export function writeSeedAssets(dir: string): GeneratedAsset[] {
  return SEED_ASSET_SPECS.map((spec) => {
    const png = solidPng(spec.width, spec.height, spec.background, spec.accent);
    const target = join(dir, spec.relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, png);
    return {
      relativePath: spec.relativePath,
      objectKey: spec.objectKey,
      bucket: spec.bucket,
      width: spec.width,
      height: spec.height,
      bytes: png.length,
    };
  });
}
