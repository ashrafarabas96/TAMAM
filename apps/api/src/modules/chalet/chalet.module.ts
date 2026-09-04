import { Module } from '@nestjs/common';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletBookingService } from './chalet-booking.service';
import { ChaletOccupancyService } from './chalet-occupancy.service';
import { ChaletOffersService } from './chalet-offers.service';
import { ChaletOwnerController } from './chalet-owner.controller';
import { ChaletPricingService } from './chalet-pricing.service';
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
  controllers: [ChaletController, ChaletOwnerController],
  providers: [
    ChaletAvailabilityService,
    ChaletPricingService,
    ChaletBookingService,
    ChaletOffersService,
    ChaletOccupancyService,
  ],
  exports: [
    ChaletAvailabilityService,
    ChaletPricingService,
    ChaletBookingService,
    ChaletOffersService,
    ChaletOccupancyService,
  ],
})
export class ChaletModule {}
