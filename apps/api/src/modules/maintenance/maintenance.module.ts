import { Module, forwardRef } from '@nestjs/common';

import { ChaletModule } from '../chalet/chalet.module';
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
 * The chalet sweeps ride along here rather than growing a second scheduler:
 * this one already guarantees that N API replicas firing the same tick produce
 * exactly one queued job, and a duplicated hold-expiry sweep is not something to
 * discover later.
 *
 * The scheduler only enqueues; the processor owns the work. Services from other modules are
 * reached through the global graph (AnalyticsModule, CampaignsModule, AuthModule,
 * NotificationsModule, SystemConfigModule are all @Global); PartnersModule and TrackingModule
 * are imported explicitly.
 */
@Module({
  imports: [ChaletModule, forwardRef(() => PartnersModule), forwardRef(() => TrackingModule)],
  controllers: [MaintenanceController],
  providers: [MaintenanceScheduler, MaintenanceProcessor, DocumentExpiryService],
  exports: [MaintenanceScheduler, DocumentExpiryService],
})
export class MaintenanceModule {}
