import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';

import {
  AccountStatusGuard,
  JwtAuthGuard,
  PermissionsGuard,
  RateLimitGuard,
} from './common/guards';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { SerializeInterceptor } from './common/interceptors/serialize.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule, AppConfigService } from './config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ProvidersModule } from './infrastructure/providers/providers.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChaletModule } from './modules/chalet/chalet.module';
import { ChatModule } from './modules/chat/chat.module';
import { SystemConfigModule } from './modules/config/config.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MediaModule } from './modules/media/media.module';
import { MetricsInterceptor } from './modules/metrics/metrics.interceptor';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RiskModule } from './modules/risk/risk.module';
import { SupportModule } from './modules/support/support.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ZonesModule } from './modules/zones/zones.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.env.LOG_LEVEL,
          transport:
            config.isProduction || config.isTest
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } },
          genReqId: (req) =>
            (req as { id?: string }).id ?? req.headers['x-request-id'] ?? 'unknown',
          customProps: (req) => ({ requestId: (req as { id?: string }).id }),
          autoLogging: {
            ignore: (req) =>
              (req.url ?? '').startsWith('/health') || (req.url ?? '').startsWith('/metrics'),
          },
          // Never log secrets (spec §90).
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.code',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.refreshToken',
              'req.body.tripPin',
              'req.body.pickupOtp',
              'req.body.deliveryOtp',
              'req.body.iban',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (req: {
              id: string;
              method: string;
              url: string;
              headers: Record<string, string>;
            }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              userAgent: req.headers['user-agent'],
            }),
          },
        },
      }),
    }),
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 50 }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    QueueModule,
    ProvidersModule,
    MetricsModule,
    AuditModule,
    SystemConfigModule,
    RbacModule,
    AuthModule,
    UsersModule,
    MediaModule,
    CatalogModule,
    ChaletModule,
    ZonesModule,
    VehiclesModule,
    PartnersModule,
    CustomersModule,
    PricingModule,
    JobsModule,
    DispatchModule,
    TrackingModule,
    QuotesModule,
    LedgerModule,
    WalletModule,
    PaymentsModule,
    PromotionsModule,
    CampaignsModule,
    NotificationsModule,
    ChatModule,
    RatingsModule,
    SupportModule,
    DisputesModule,
    AnalyticsModule,
    RiskModule,
    AdminModule,
    MaintenanceModule,
    HealthModule,
  ],
  providers: [
    // Guard order matters: rate limit → auth → account status → permissions
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccountStatusGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
