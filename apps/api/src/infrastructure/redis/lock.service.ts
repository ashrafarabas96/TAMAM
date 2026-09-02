import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/** Simple, correct single-node Redis lock (SET NX PX + compare-and-delete). Used for dispatch accept hot path. */
@Injectable()
export class LockService {
  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const ok = await this.redis.client.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
    return ok === 'OK' ? token : null;
  }

  async release(key: string, token: string): Promise<void> {
    await this.redis.client.eval(RELEASE_SCRIPT, 1, `lock:${key}`, token);
  }

  /** Runs fn while holding the lock; throws `LockBusyError` when unavailable. */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquire(key, ttlMs);
    if (!token) throw new LockBusyError(key);
    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}

export class LockBusyError extends Error {
  constructor(key: string) {
    super(`lock busy: ${key}`);
    this.name = 'LockBusyError';
  }
}
