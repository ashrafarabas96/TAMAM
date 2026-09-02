import { Global, Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Product analytics, the ops dashboard, KPIs and reporting (spec §116–§118).
 *
 * Global because the maintenance scheduler calls `AnalyticsService.computeDailyKpis()` and the
 * admin module reuses the dashboard aggregates from its own module graph.
 */
@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
