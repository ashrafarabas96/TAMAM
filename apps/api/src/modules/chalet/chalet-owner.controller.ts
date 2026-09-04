import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ChaletOccupancyDto } from '@tamam/shared-types';
import {
  type ChaletAutomationInput,
  type ChaletAvailabilityQuery,
  type ChaletBookingListInput,
  type ExternalChaletBookingInput,
  chaletAutomationSchema,
  chaletAvailabilityQuerySchema,
  chaletBookingListSchema,
  externalChaletBookingSchema,
} from '@tamam/validation';

import { AllowRestricted, CurrentUser, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletBookingService } from './chalet-booking.service';
import { ChaletOccupancyService } from './chalet-occupancy.service';
import { ChaletOffersService } from './chalet-offers.service';

/**
 * The owner's side of a chalet (spec §81).
 *
 * The point of this surface is that an owner never has to keep a second
 * calendar. A booking taken over the phone goes in here and occupies the slot
 * exactly like one made through the app, so TAMAM stays the one place to look.
 */
@ApiTags('chalet-owner')
@ApiBearerAuth()
@Controller('owner/chalets')
export class ChaletOwnerController {
  constructor(
    private readonly availability: ChaletAvailabilityService,
    private readonly bookings: ChaletBookingService,
    private readonly offers: ChaletOffersService,
    private readonly occupancy: ChaletOccupancyService,
  ) {}

  /**
   * The chalets this owner has. Everything else on this controller needs one,
   * so without it the dashboard has no way in.
   */
  @Get()
  @AllowRestricted()
  myChalets(@CurrentUser() user: RequestUser) {
    return this.occupancy.listForOwner(user.id);
  }

  /** The bookings on one chalet, newest first. */
  @Get(':id/bookings')
  @AllowRestricted()
  async listBookings(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletBookingListSchema) query: ChaletBookingListInput,
  ) {
    await this.occupancy.assertOwner(user, chaletId);
    return this.occupancy.listBookings(chaletId, query);
  }

  /**
   * The switches an owner flips from the dashboard.
   *
   * Deliberately separate from editing the chalet: turning Smart Pricing on is
   * a decision about how the chalet is sold, and an owner should be able to
   * make it without opening a form that could also change their address.
   */
  @Patch(':id/automation')
  @AllowRestricted()
  async setAutomation(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodBody(chaletAutomationSchema) input: ChaletAutomationInput,
  ) {
    await this.occupancy.assertOwner(user, chaletId);
    return this.occupancy.setAutomation(chaletId, input);
  }

  /** The owner's own calendar for a day: what is booked, blocked and free. */
  @Get(':id/calendar')
  @AllowRestricted()
  async calendar(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletAvailabilityQuerySchema) query: ChaletAvailabilityQuery,
  ) {
    await this.occupancy.assertOwner(user, chaletId);
    return this.availability.forDate(chaletId, query.date);
  }

  /**
   * Whether the chalet is earning, and where the empty hours are. Occupancy is
   * measured against the chalet's own opening hours, so a chalet that closes
   * overnight is not reported as a third empty for being closed.
   */
  @Get(':id/occupancy')
  @AllowRestricted()
  async occupancyReport(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletAvailabilityQuerySchema) query: ChaletAvailabilityQuery,
  ): Promise<ChaletOccupancyDto> {
    await this.occupancy.assertOwner(user, chaletId);
    return this.occupancy.report(chaletId, query.date);
  }

  /** The empty stretches boxed in between bookings — the revenue quietly evaporating. */
  @Get(':id/gaps')
  @AllowRestricted()
  async gaps(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodQuery(chaletAvailabilityQuerySchema) query: ChaletAvailabilityQuery,
  ) {
    await this.occupancy.assertOwner(user, chaletId);
    const windows = await this.offers.gapsForOwner(chaletId, query.date);
    return windows.map((w) => ({
      startAt: w.startAt.toISOString(),
      endAt: w.endAt.toISOString(),
      availableMinutes: w.availableMinutes,
      isGap: w.isGap,
    }));
  }

  /**
   * Record a booking taken somewhere else. It never goes through payment, so it
   * is confirmed on arrival — and the same exclusion constraint applies, so an
   * owner cannot type one in over a booking a customer already made.
   */
  @Post(':id/bookings/external')
  @AllowRestricted()
  createExternal(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) chaletId: string,
    @ZodBody(externalChaletBookingSchema) input: ExternalChaletBookingInput,
  ) {
    return this.bookings.createExternal({ user }, chaletId, input);
  }
}
