import { Module, forwardRef } from '@nestjs/common';

import { DispatchModule } from '../dispatch/dispatch.module';
import { DisputesModule } from '../disputes/disputes.module';
import { JobsModule } from '../jobs/jobs.module';
import { SupportModule } from '../support/support.module';
import { AdminOverviewService } from './admin-overview.service';
import { AdminSearchService } from './admin-search.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminGateway } from './admin.gateway';
import { DispatcherService } from './dispatcher.service';

/**
 * Admin panel back-end (spec §139–§142): staff accounts, unified search, dispatcher console,
 * home overview and the `/admin` live map namespace.
 *
 * It is a pure consumer module — no other module imports it — so the dependencies below are
 * plain imports. `JobsModule` and `DispatchModule` are wrapped in `forwardRef` because they are
 * themselves part of a cycle (jobs ↔ dispatch ↔ partners) and Nest resolves the shared graph
 * more predictably when every edge into it is lazy.
 *
 * Cross-module services used through the global module graph: AnalyticsService (AnalyticsModule
 * is @Global), TokenService/SessionService/AuthService (AuthModule), UsersService (UsersModule),
 * AuditService, SystemConfigService, MetricsService, PrismaService.
 */
@Module({
  imports: [forwardRef(() => JobsModule), forwardRef(() => DispatchModule), SupportModule, DisputesModule],
  controllers: [AdminController],
  providers: [AdminUsersService, AdminSearchService, DispatcherService, AdminOverviewService, AdminGateway],
  exports: [AdminUsersService, AdminSearchService, DispatcherService],
})
export class AdminModule {}
