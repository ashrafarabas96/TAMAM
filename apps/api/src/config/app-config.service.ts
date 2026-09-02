import { Injectable } from '@nestjs/common';

import { type Env, parseEnv } from './env.schema';

/**
 * Typed, validated configuration. Import `AppConfigService` anywhere; never read
 * `process.env` directly outside this file.
 */
@Injectable()
export class AppConfigService {
  readonly env: Env;

  constructor() {
    this.env = parseEnv(process.env);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get encryptionKey(): Buffer {
    const key = Buffer.from(this.env.ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be base64 of exactly 32 bytes');
    }
    return key;
  }
}
