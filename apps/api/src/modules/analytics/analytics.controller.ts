import { Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type ReportQueryInput, isoDateTimeSchema, reportQuerySchema, uuidSchema } from '@tamam/validation';
import type { Response } from 'express';
import { z } from 'zod';

import { CurrentUser, Public, RateLimit, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { toJsonSafe } from '../../common/interceptors/serialize.interceptor';
import type { RequestUser } from '../../common/types/request-user';
import { AnalyticsService } from './analytics.service';

const trackEventsSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().trim().max(40).optional(),
  events: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        occurredAt: isoDateTimeSchema,
        props: z.record(z.unknown()).optional(),
        jobId: uuidSchema.optional(),
        zoneId: uuidSchema.optional(),
        sessionId: z.string().trim().min(8).max(128).optional(),
      }),
    )
    .min(1)
    .max(100),
});

const kpiQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  zoneId: uuidSchema.optional(),
});

@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Client event ingestion. Signed-out sessions are accepted; unknown event names are dropped. */
  @Public()
  @Post('analytics/events')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'analytics-events', limit: 120, windowSeconds: 60, keyBy: 'user-or-ip' })
  track(@ZodBody(trackEventsSchema) body: z.infer<typeof trackEventsSchema>, @CurrentUser() user: RequestUser | undefined) {
    return this.analytics.track(user ?? null, body.events, body.platform ?? null, body.appVersion ?? null);
  }

  @ApiBearerAuth()
  @Get('admin/dashboard')
  @RequirePermission(Permission.ANALYTICS_READ)
  dashboard() {
    return this.analytics.opsDashboard();
  }

  @ApiBearerAuth()
  @Get('admin/kpis')
  @RequirePermission(Permission.ANALYTICS_READ)
  kpis(@ZodQuery(kpiQuerySchema) query: z.infer<typeof kpiQuerySchema>) {
    return this.analytics.kpis(query.from, query.to, query.zoneId);
  }

  /**
   * Operational report. `format=json` needs ANALYTICS_READ; `csv`/`xlsx` additionally need
   * REPORTS_EXPORT (asserted in the service) and are streamed as an attachment.
   */
  @ApiBearerAuth()
  @Get('admin/reports')
  @RequirePermission(Permission.ANALYTICS_READ)
  async reports(@ZodQuery(reportQuerySchema) query: ReportQueryInput, @CurrentUser() user: RequestUser, @Res() res: Response): Promise<void> {
    if (query.format === 'json') {
      const result = await this.analytics.report(query);
      res.status(HttpStatus.OK).json(toJsonSafe(result));
      return;
    }
    const file = await this.analytics.exportReport(query, user);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.status(HttpStatus.OK).send(file.body);
  }
}
