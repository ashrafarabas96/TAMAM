// The seed reuses application classes (AuthService.hashPassword, the notification templates);
// their @Injectable() decorators need the metadata polyfill, exactly like src/main.ts.
import 'reflect-metadata';

import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { AppConfigService } from '../src/config';
import { seedCampaign } from './seed/campaigns';
import { seedCatalog } from './seed/catalog';
import { type SeedContext, SeedSummary, log } from './seed/context';
import { seedPlatform } from './seed/platform';
import { writeSeedAssets } from './seed/png';
import { seedPricing } from './seed/pricing';
import { seedUsers } from './seed/users';
import { seedZones } from './seed/zones';

/**
 * DEVELOPMENT seed (spec §160).
 *
 * It writes demo identities with known phone numbers and a known admin password, so it MUST NOT
 * run against production — the guard below is the first thing that executes. Everything is
 * upserted by a natural key, so running it repeatedly converges on the same state.
 *
 *   pnpm --filter @tamam/api seed
 *   SEED_ADMIN_PASSWORD='…' pnpm --filter @tamam/api seed
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('prisma/seed.ts creates demo accounts and must never run with NODE_ENV=production');
  }

  const config = new AppConfigService();
  if (config.isProduction) {
    throw new Error('prisma/seed.ts refuses to run against a production configuration');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: config.env.DATABASE_URL } } });
  const assetsDir = resolve(__dirname, '../../../infrastructure/docker/seed-assets');
  const ctx: SeedContext = {
    prisma,
    config,
    currency: 'ILS',
    timezone: config.env.DEFAULT_TIMEZONE,
    assetsDir,
    summary: new SeedSummary(),
  };

  const started = Date.now();
  log('TAMAM development seed');
  log(`  database : ${config.env.DATABASE_URL.replace(/:\/\/[^@]*@/, '://***@')}`);
  log(`  env      : ${config.env.NODE_ENV}`);
  log('');

  try {
    log('· platform (configs, flags, roles, templates)');
    await seedPlatform(ctx);

    log('· catalogue (service types, vehicles, packages, home services)');
    const catalog = await seedCatalog(ctx);

    log('· zones (Ramallah, Nablus, Hebron)');
    const zones = await seedZones(ctx);

    log('· pricing (rules, commission, cancellation, referral, promo)');
    await seedPricing(ctx, catalog);

    log('· users (staff, demo customer, demo partners)');
    const users = await seedUsers(ctx, catalog, zones);

    log('· placeholder creatives');
    const assets = writeSeedAssets(assetsDir);
    ctx.summary.set('placeholder images', assets.length);

    log('· campaign & banners');
    await seedCampaign(ctx, catalog, zones, users.superAdminId);

    log('');
    log('Seed complete in ' + `${((Date.now() - started) / 1000).toFixed(1)}s`);
    log(ctx.summary.render());
    log('');
    log(`  placeholder PNGs written to ${assetsDir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Seed failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exitCode = 1;
});
