import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';

/** Sliding-window counter implemented atomically in Lua. */
const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", key, 0, now - window * 1000)
local count = redis.call("ZCARD", key)
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retry = window
  if oldest[2] then retry = math.ceil((tonumber(oldest[2]) + window * 1000 - now) / 1000) end
  return {0, limit - count, retry}
end
redis.call("ZADD", key, now, now .. "-" .. math.random(1000000))
redis.call("PEXPIRE", key, window * 1000)
return {1, limit - count - 1, 0}
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const res = (await this.redis.client.eval(SCRIPT, 1, `rl:${key}`, Date.now(), windowSeconds, limit)) as [number, number, number];
    return { allowed: res[0] === 1, remaining: Number(res[1]), retryAfterSeconds: Math.max(1, Number(res[2])) };
  }

  /** Read-only check (no increment) — used by OTP resend cooldown display. */
  async peek(key: string): Promise<number> {
    return this.redis.client.zcard(`rl:${key}`);
  }
}
