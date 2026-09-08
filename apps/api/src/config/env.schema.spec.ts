import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { envSchema } from './env.schema';

/**
 * The compose file ships working development defaults so a first run needs no
 * setup. The same values must never boot in production. This reads the real
 * compose file rather than a copy of it, so a new default added there without
 * a matching guard entry fails here. The `environment:` block of the api
 * service is a flat `KEY: value` map, read here without a YAML dependency.
 */
function composeDefaults(): Record<string, string> {
  const file = resolve(__dirname, '../../../../infrastructure/docker/docker-compose.yml');
  const text = readFileSync(file, 'utf8');
  const api = text.slice(text.indexOf('\n  api:\n'));
  const envStart = api.indexOf('    environment:\n');
  const block = api.slice(envStart + '    environment:\n'.length);
  const out: Record<string, string> = {};
  for (const line of block.split('\n')) {
    if (!line.startsWith('      ')) break; // left the environment map
    const m = /^\s{6}([A-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    // YAML scalars may be quoted ('3000', 'true'); the process sees them bare.
    const value = (m[2] ?? '').trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    const withDefault = /^\$\{[A-Z0-9_]+:-(.*)\}$/.exec(value);
    if (withDefault) out[m[1] as string] = withDefault[1] ?? '';
    else if (!/^\$\{[A-Z0-9_]+\}$/.test(value)) out[m[1] as string] = value;
  }
  return out;
}

describe('env schema production guard', () => {
  const defaults = composeDefaults();

  it('accepts the compose defaults in development', () => {
    const r = envSchema.safeParse({ ...defaults, NODE_ENV: 'development' });
    if (!r.success) {
      // Say which key and why, rather than a bare false.
      throw new Error(
        `development refused: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')} ` +
          `(parsed keys: ${Object.keys(defaults).join(', ')})`,
      );
    }
  });

  it('refuses every compose secret in production', () => {
    const r = envSchema.safeParse({ ...defaults, NODE_ENV: 'production', SMS_PROVIDER: 'http' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const flagged = new Set(r.error.issues.map((i) => i.path.join('.')));
    for (const key of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'OTP_PEPPER',
      'ENCRYPTION_KEY',
      'SEED_ADMIN_PASSWORD',
    ]) {
      expect(flagged).toContain(key);
    }
  });
});
