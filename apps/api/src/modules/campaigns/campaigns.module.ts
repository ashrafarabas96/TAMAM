import { Global, Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { BannerAttributionService } from './banner-attribution.service';
import { BannerEventsService } from './banner-events.service';
import { BannerFeedService } from './banner-feed.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

/**
 * Promotional campaigns and in-app banners (spec §80–§82).
 *
 * Global because the maintenance scheduler calls `CampaignsService.activateScheduled()`,
 * `.endExpired()` and `BannerAttributionService.rollupDaily()` from its own module.
 */
@Global()
@Module({
  imports: [MediaModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, BannerFeedService, BannerEventsService, BannerAttributionService],
  exports: [CampaignsService, BannerFeedService, BannerEventsService, BannerAttributionService],
})
export class CampaignsModule {}
