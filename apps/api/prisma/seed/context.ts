import type { PrismaClient } from '@prisma/client';

import { AppConfigService } from '../../src/config';

/**
 * Shared plumbing for the development seed. Nothing here talks to Nest — the seed is a plain
 * script so `pnpm --filter @tamam/api seed` works without booting the application.
 */
export interface SeedContext {
  prisma: PrismaClient;
  config: AppConfigService;
  /** Currency of the launch region; every seeded amount is in its minor unit (agorot). */
  currency: 'ILS';
  timezone: string;
  /** Directory the placeholder PNGs are written to. */
  assetsDir: string;
  summary: SeedSummary;
}

export class SeedSummary {
  private readonly counters = new Map<string, number>();
  private readonly notes: string[] = [];

  count(label: string, value = 1): void {
    this.counters.set(label, (this.counters.get(label) ?? 0) + value);
  }

  set(label: string, value: number): void {
    this.counters.set(label, value);
  }

  note(line: string): void {
    this.notes.push(line);
  }

  render(): string {
    const width = Math.max(...[...this.counters.keys()].map((k) => k.length), 10);
    const rows = [...this.counters.entries()].map(
      ([label, value]) => `  ${label.padEnd(width)}  ${String(value).padStart(6)}`,
    );
    return [...rows, '', ...this.notes.map((n) => `  • ${n}`)].join('\n');
  }
}

/** Minor units per major unit for ILS — every price constant below is written in agorot. */
export const AGORA = 100;
export const shekels = (major: number): bigint => BigInt(Math.round(major * AGORA));

/** `console` is banned in `src/**`; the seed is a CLI script whose output is the deliverable. */
export function log(message: string): void {
  process.stdout.write(`${message}\n`);
}
