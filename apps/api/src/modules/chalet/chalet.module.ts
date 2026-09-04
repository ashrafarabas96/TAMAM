import { Module } from '@nestjs/common';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletPricingService } from './chalet-pricing.service';

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
  providers: [ChaletAvailabilityService, ChaletPricingService],
  exports: [ChaletAvailabilityService, ChaletPricingService],
})
export class ChaletModule {}
