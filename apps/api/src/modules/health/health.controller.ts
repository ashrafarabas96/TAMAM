import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';

import { Public } from '../../common/decorators';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infrastructure/providers/storage/storage.provider';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

/** Liveness/readiness without leaking internals (spec §115). */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly config: AppConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Public()
  @Get('health/live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('health/ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      },
      async (): Promise<HealthIndicatorResult> => ({ redis: { status: (await this.redis.ping()) ? 'up' : 'down' } }),
      async (): Promise<HealthIndicatorResult> => ({ storage: { status: (await this.storage.healthCheck()) ? 'up' : 'down' } }),
    ]);
  }

  @Public()
  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4')
  async prometheus(): Promise<string> {
    if (!this.config.env.METRICS_ENABLED) return '';
    return this.metrics.metrics();
  }
}
