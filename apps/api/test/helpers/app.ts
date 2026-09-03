import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX, type AuthSession } from '@tamam/shared-types';
import { Logger, PinoLogger } from 'nestjs-pino';
import supertest from 'supertest';

import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../../src/infrastructure/redis/redis.service';

export const API_ROOT = resolve(__dirname, '../..');
export const REPO_ROOT = resolve(API_ROOT, '../..');

/** Phone numbers created by `prisma/seed.ts`. */
export const SEED = {
  customerPhone: '+970599000001',
  driverPhone: '+970599000002',
  courierPhone: '+970599000003',
  technicianPhone: '+970599000004',
  adminEmail: 'admin@tamam.app',
  supportEmail: 'support@tamam.app',
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'TamamAdmin#2026',
} as const;

export interface AuthContext {
  userId: string;
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  /** `Authorization: Bearer …` ready to spread into `.set(...)`. */
  headers: Record<string, string>;
}

/**
 * Operational tables wiped between suites. Reference data (catalogue, zones, pricing, users,
 * campaigns, configuration) survives so every spec starts from the seeded world.
 *
 * `ledger_entries`, `ledger_transactions`, `audit_logs`, `job_events` and `pricing_snapshots`
 * are append-only: a DELETE is blocked by `tamam_forbid_mutation`, but TRUNCATE does not fire
 * row-level triggers, which is exactly why this uses TRUNCATE.
 */
const OPERATIONAL_TABLES = [
  'jobs',
  'job_stops',
  'job_media',
  'job_service_options',
  'job_delivery_details',
  'job_assignments',
  'job_events',
  'job_tracking_points',
  'job_share_links',
  'sos_alerts',
  'service_quotes',
  'service_quote_items',
  'pricing_snapshots',
  'payments',
  'payment_attempts',
  'refunds',
  'receipts',
  'webhook_events',
  'idempotency_keys',
  'ledger_transactions',
  'ledger_entries',
  'ledger_accounts',
  'wallets',
  'withdrawals',
  'promo_redemptions',
  'referral_rewards',
  'reviews',
  'chats',
  'chat_members',
  'messages',
  'notifications',
  'support_tickets',
  'support_messages',
  'support_attachments',
  'user_reports',
  'disputes',
  'dispute_messages',
  'dispute_evidence',
  'banner_events',
  'banner_daily_stats',
  'analytics_events',
  'daily_kpis',
  'audit_logs',
  'risk_signals',
  'restrictions',
  // partner_availability has an FK to jobs, so TRUNCATE … CASCADE would clear it anyway;
  // it is listed explicitly and re-created below with a clean OFFLINE row per partner.
  'partner_availability',
];

export class TestApp {
  private readonly tokenCache = new Map<string, AuthContext>();

  private constructor(
    readonly app: INestApplication,
    readonly prisma: PrismaService,
    readonly redis: RedisService,
  ) {}

  static async boot(): Promise<TestApp> {
    if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
    ensureDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication({ rawBody: true, bufferLogs: true });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.setGlobalPrefix(API_PREFIX, { exclude: ['health/live', 'health/ready', 'metrics'] });
    app.useGlobalFilters(new AllExceptionsFilter(app.get(PinoLogger)));
    await app.init();

    const instance = new TestApp(app, app.get(PrismaService), app.get(RedisService));
    await instance.openZonesForTesting();
    return instance;
  }

  /**
   * The seed opens every zone 06:00–23:59 Asia/Jerusalem, which is the product decision. A CI run
   * that starts between 21:00 and 03:00 UTC would otherwise be rejected with
   * OUTSIDE_OPERATING_HOURS before it reaches the behaviour under test, so the *test database*
   * runs its zones around the clock. `ZonesService.isOpen` treats "no row for the day" as "no
   * restriction", so removing the rows is the deterministic way to do it; operating-hours
   * enforcement itself is covered by that method's unit tests.
   */
  async openZonesForTesting(): Promise<void> {
    await this.prisma.zoneOperatingHours.deleteMany({});
  }

  request(): ReturnType<typeof supertest> {
    return supertest(this.app.getHttpServer());
  }

  /** Full path helper: `api.url('jobs')` → `/api/v1/jobs`. */
  url(path: string): string {
    return `${API_PREFIX}/${path.replace(/^\//, '')}`;
  }

  /* ------------------------------------------------------------- logins */
  loginCustomer(phone: string = SEED.customerPhone, deviceId = 'e2e-customer-device'): Promise<AuthContext> {
    return this.loginWithOtp(phone, 'CUSTOMER', deviceId);
  }

  loginPartner(phone: string = SEED.driverPhone, deviceId = 'e2e-partner-device'): Promise<AuthContext> {
    return this.loginWithOtp(phone, 'PARTNER', deviceId);
  }

  /**
   * Real OTP round-trip: the console SMS provider returns the code as `devCode`, so the test
   * exercises exactly the endpoints the apps call. Results are cached per phone + audience.
   */
  private async loginWithOtp(phone: string, audience: 'CUSTOMER' | 'PARTNER', deviceId: string): Promise<AuthContext> {
    const cacheKey = `${audience}:${phone}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached) return cached;

    // Clear the resend cooldown and the per-IP/per-phone limiter so a suite can log several users in.
    await this.prisma.otpRequest.deleteMany({ where: { phone } });
    await this.resetRateLimits();

    const requested = await this.request().post(this.url('auth/otp/request')).send({ phone, audience, language: 'ar' }).expect(200);
    const devCode = (requested.body as { devCode?: string }).devCode;
    if (!devCode) throw new Error('The console SMS provider did not return devCode — set SMS_PROVIDER=console for tests');

    const verified = await this.request()
      .post(this.url('auth/otp/verify'))
      .send({ phone, code: devCode, audience, language: 'ar', device: { deviceId, platform: 'android', appVersion: 'e2e' } })
      .expect(200);

    const session = verified.body as AuthSession;
    const ctx: AuthContext = {
      userId: session.user.id,
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      deviceId,
      headers: { Authorization: `Bearer ${session.tokens.accessToken}`, 'X-Device-Id': deviceId },
    };
    this.tokenCache.set(cacheKey, ctx);
    return ctx;
  }

  async loginAdmin(email: string = SEED.adminEmail, password: string = SEED.adminPassword, deviceId = 'e2e-admin-device'): Promise<AuthContext> {
    const cacheKey = `ADMIN:${email}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached) return cached;

    await this.resetRateLimits();
    const res = await this.request()
      .post(this.url('auth/admin/login'))
      .send({ email, password, device: { deviceId, platform: 'web', appVersion: 'e2e' } })
      .expect(200);

    const session = res.body as AuthSession;
    const ctx: AuthContext = {
      userId: session.user.id,
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      deviceId,
      headers: { Authorization: `Bearer ${session.tokens.accessToken}`, 'X-Device-Id': deviceId },
    };
    this.tokenCache.set(cacheKey, ctx);
    return ctx;
  }

  /** Drops every sliding-window counter so endpoint rate limits never fail a test run. */
  async resetRateLimits(): Promise<void> {
    const keys = await this.redis.client.keys('rl:*');
    if (keys.length) await this.redis.client.del(...keys);
  }

  /* ------------------------------------------------------------ cleanup */
  async truncateOperationalTables(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${OPERATIONAL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    // Restore the availability row every partner is expected to have.
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO partner_availability (partner_id, status, active_roles, updated_at)
      SELECT user_id, 'OFFLINE'::availability_status, ARRAY[]::partner_role_type[], now() FROM partner_profiles
      ON CONFLICT (partner_id) DO NOTHING`);
    // Reset the cached counters the seeded profiles carry.
    await this.prisma.$executeRawUnsafe(`UPDATE customer_profiles SET completed_jobs = 0, cancelled_jobs = 0, rating_sum = 0, rating_count = 0, first_job_at = NULL`);
    await this.prisma.$executeRawUnsafe(`UPDATE partner_profiles SET completed_jobs = 0, cancelled_jobs = 0, rating_sum = 0, rating_count = 0, offers_received = 0, offers_accepted = 0, penalty_points = 0`);
    await this.prisma.$executeRawUnsafe(`UPDATE promo_codes SET usage_count = 0`);
    await this.resetRateLimits();
    await this.redis.del(...(await this.redis.client.keys('estimate:*')));
    await this.redis.del(...(await this.redis.client.keys('loc:*')));
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

/* --------------------------------------------------------------- bootstrap */
let databaseReady = false;

/**
 * Applies migrations and the development seed once per process. Both steps are guarded by a
 * cheap check so the second and later spec files start immediately.
 */
function ensureDatabase(): void {
  if (databaseReady) return;
  const migrationsDir = resolve(API_ROOT, 'prisma/migrations');
  if (!existsSync(migrationsDir) || readdirSync(migrationsDir).filter((f) => !f.endsWith('.toml')).length === 0) {
    run('bash', [resolve(REPO_ROOT, 'scripts/db/create-init-migration.sh')], REPO_ROOT);
  }
  run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], API_ROOT);
  run('pnpm', ['exec', 'ts-node', '-r', 'tsconfig-paths/register', 'prisma/seed.ts'], API_ROOT);
  databaseReady = true;
}

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: process.env.E2E_VERBOSE ? 'inherit' : 'pipe', env: process.env });
}

/* ------------------------------------------------------------------ utils */

/** Polls `probe` until it returns a truthy value or the timeout elapses. */
export async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, options: { timeoutMs?: number; intervalMs?: number; label?: string } = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last as T;
    await sleep(intervalMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs} ms${options.label ? `: ${options.label}` : ''}`);
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** ISO timestamp for "now", the shape every location sample uses. */
export const nowIso = (): string => new Date().toISOString();

/** A location sample near the Ramallah zone centre. */
export function sampleAt(lat: number, lng: number, accuracy = 8): { lat: number; lng: number; accuracy: number; timestamp: string } {
  return { lat, lng, accuracy, timestamp: nowIso() };
}

export const RAMALLAH = { lat: 31.9038, lng: 35.2034 };
