import { Global, Module } from '@nestjs/common';

import { LockService } from './lock.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, LockService, RateLimitService],
  exports: [RedisService, LockService, RateLimitService],
})
export class RedisModule {}
