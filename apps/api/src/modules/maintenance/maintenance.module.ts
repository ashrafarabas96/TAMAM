import { Module, forwardRef } from '@nestjs/common';

import { PartnersModule } from '../partners/partners.module';
import { TrackingModule } from '../tracking/tracking.module';
import { DocumentExpiryService } from './document-expiry.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceProcessor } from './maintenance.processor';
import { MaintenanceScheduler } from './maintenance.scheduler';

/**
 * Scheduled platform housekeeping (spec §160): heartbeat sweeps, campaign scheduling, retention
 * purges, daily KPIs, banner roll-ups and partner document expiry.
 *
 * The scheduler only enqueues; the processor owns the work. Services from other modules are
 * reached through the global graph (AnalyticsModule, CampaignsModule, AuthModule,
 * NotificationsModule, SystemConfigModule are all @Global); PartnersModule and TrackingModule
 * are imported explicitly.
 */
@Module({
  imports: [forwardRef(() => PartnersModule), forwardRef(() => TrackingModule)],
  controllers: [MaintenanceController],
  providers: [MaintenanceScheduler, MaintenanceProcessor, DocumentExpiryService],
  exports: [MaintenanceScheduler, DocumentExpiryService],
})
export class MaintenanceModule {}
