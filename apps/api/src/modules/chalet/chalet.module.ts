import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletBookingService } from './chalet-booking.service';
import { ChaletOccupancyService } from './chalet-occupancy.service';
import { ChaletOffersService } from './chalet-offers.service';
import { ChaletOwnerController } from './chalet-owner.controller';
import { ChaletPricingService } from './chalet-pricing.service';
import { ChaletSearchService } from './chalet-search.service';
import { ChaletController } from './chalet.controller';

/**
 * TAMAM Chalet — hourly chalet booking (spec §1–§85).
 *
 * The module is deliberately its own thing rather than another job type: a
 * chalet booking is a window of time on one property, not a job dispatched to a
 * partner, and nothing about dispatch, tracking or offers applies to it. It
 * reuses the platform's shared services — payments, notifications, media,
 * zones, audit — but keeps its own domain.
 */
@Module({
  // MediaModule is not global; the search results need MediaUrlService to turn a
  // stored object key into a cover photo URL.
  imports: [MediaModule],
  controllers: [ChaletController, ChaletOwnerController],
  providers: [
    ChaletAvailabilityService,
    ChaletPricingService,
    ChaletBookingService,
    ChaletOffersService,
    ChaletOccupancyService,
    ChaletSearchService,
  ],
  exports: [
    ChaletAvailabilityService,
    ChaletPricingService,
    ChaletBookingService,
    ChaletOffersService,
    ChaletOccupancyService,
    ChaletSearchService,
  ],
})
export class ChaletModule {}
