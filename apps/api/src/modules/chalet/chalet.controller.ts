import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@tamam/shared-types';
import {
  type CancelChaletBookingInput,
  type ChaletAvailabilityQuery,
  type ExtendChaletBookingInput,
  type HoldChaletBookingInput,
  cancelChaletBookingSchema,
  chaletAvailabilityQuerySchema,
  chaletSlotCheckSchema,
  extendChaletBookingSchema,
  holdChaletBookingSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  CurrentUser,
  Public,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletBookingService } from './chalet-booking.service';
import { ChaletOffersService } from './chalet-offers.service';
import { ChaletPricingService } from './chalet-pricing.service';

type SlotCheckQuery = z.infer<typeof chaletSlotCheckSchema>;

/**
 * What a customer can do with a chalet (spec §80).
 *
 * Availability and prices are public: a customer should be able to see whether
 * a chalet is free this Thursday before being asked to sign in. Everything that
 * touches the calendar needs an account.
 */
@ApiTags('chalets')
@ApiBearerAuth()
@Controller('chalets')
export class ChaletController {
  constructor(
    private readonly availability: ChaletAvailabilityService,
    private readonly pricing: ChaletPricingService,
    private readonly offers: ChaletOffersService,
    private readonly bookings: ChaletBookingService,
  ) {}

  /** The free windows and workable start times on one day, cleaning already subtracted. */
  @Get(':id/availability')
  @Public()
  availabilityForDate(
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletAvailabilityQuerySchema) query: ChaletAvailabilityQuery,
  ) {
    return this.availability.forDate(chaletId, query.date, {
      ...(query.durationMinutes === undefined ? {} : { durationMinutes: query.durationMinutes }),
    });
  }

  /**
   * Whether one exact window can be booked, with the price if it can and
   * alternatives if it cannot. The answer is advisory — the database decides at
   * the write — but it is what lets the app say *why*.
   */
  @Get(':id/slot-check')
  @Public()
  async checkSlot(
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletSlotCheckSchema) query: SlotCheckQuery,
  ) {
    const window = { startAt: new Date(query.startAt), endAt: new Date(query.endAt) };
    const verdict = await this.availability.checkWindow(chaletId, window);
    const price = verdict.available
      ? this.pricing.toBreakdown(await this.pricing.quote(chaletId, window))
      : null;

    return {
      available: verdict.available,
      reason: verdict.reason,
      alternatives: verdict.alternatives.map((w) => ({
        startAt: w.startAt.toISOString(),
        endAt: w.endAt.toISOString(),
        availableMinutes: w.availableMinutes,
        isGap: w.isGap,
      })),
      price,
    };
  }

  /** The discounts currently live on this chalet. */
  @Get(':id/offers')
  @Public()
  liveOffers(@Param('id', UuidPipe) chaletId: string) {
    return this.offers.liveOffers(chaletId);
  }

  /**
   * Take a hold. The slot is occupied for the chalet's hold window while the
   * customer pays, so nobody can take it out from under them mid-checkout.
   */
  @Post('bookings')
  @RequireRole(UserRole.CUSTOMER)
  hold(@CurrentUser() user: RequestUser, @ZodBody(holdChaletBookingSchema) input: HoldChaletBookingInput) {
    return this.bookings.hold({ user }, input);
  }

  @Post('bookings/:id/confirm')
  @RequireRole(UserRole.CUSTOMER)
  confirm(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) bookingId: string) {
    return this.bookings.confirm({ user }, bookingId);
  }

  @Post('bookings/:id/cancel')
  @AllowRestricted()
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) bookingId: string,
    @ZodBody(cancelChaletBookingSchema) input: CancelChaletBookingInput,
  ) {
    return this.bookings.cancel({ user }, bookingId, input);
  }

  /** Add time to a booking already under way, if the extra time is free. */
  @Post('bookings/:id/extend')
  @RequireRole(UserRole.CUSTOMER)
  extend(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) bookingId: string,
    @ZodBody(extendChaletBookingSchema) input: ExtendChaletBookingInput,
  ) {
    return this.bookings.extend({ user }, bookingId, input);
  }
}
