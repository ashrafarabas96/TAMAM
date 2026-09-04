import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type UpsertSavedPlaceInput,
  favoriteServiceSchema,
  jobListFilterSchema,
  pageRequestSchema,
  reorderSchema,
  upsertSavedPlaceSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  CurrentUser,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { CustomersService } from './customers.service';

const customerJobsQuerySchema = jobListFilterSchema.merge(pageRequestSchema);
type CustomerJobsQuery = z.infer<typeof customerJobsQuerySchema>;
type FavoriteServiceBody = z.infer<typeof favoriteServiceSchema>;
type ReorderBody = z.infer<typeof reorderSchema>;

@ApiTags('customers')
@ApiBearerAuth()
@Controller()
@RequireRole('CUSTOMER')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('customers/me')
  @AllowRestricted()
  me(@CurrentUser() user: RequestUser) {
    return this.customers.getProfile(user.id);
  }

  /* --------------------------------------------------------- saved places */

  @Get('customers/me/places')
  @AllowRestricted()
  places(@CurrentUser() user: RequestUser) {
    return this.customers.listPlaces(user.id);
  }

  @Post('customers/me/places')
  createPlace(
    @CurrentUser() user: RequestUser,
    @ZodBody(upsertSavedPlaceSchema) input: UpsertSavedPlaceInput,
  ) {
    return this.customers.upsertPlace(user.id, input);
  }

  @Put('customers/me/places/:id')
  updatePlace(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) id: string,
    @ZodBody(upsertSavedPlaceSchema) input: UpsertSavedPlaceInput,
  ) {
    return this.customers.updatePlace(user.id, id, input);
  }

  @Delete('customers/me/places/:id')
  async deletePlace(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    await this.customers.deletePlace(user.id, id);
    return { ok: true };
  }

  /* ------------------------------------------------------------ favourites */

  @Get('customers/me/favorites')
  @AllowRestricted()
  favorites(@CurrentUser() user: RequestUser) {
    return this.customers.listFavorites(user.id);
  }

  @Post('customers/me/favorites')
  addFavorite(
    @CurrentUser() user: RequestUser,
    @ZodBody(favoriteServiceSchema) input: FavoriteServiceBody,
  ) {
    return this.customers.addFavorite(user.id, input.categoryId);
  }

  @Delete('customers/me/favorites/:categoryId')
  removeFavorite(
    @CurrentUser() user: RequestUser,
    @Param('categoryId', UuidPipe) categoryId: string,
  ) {
    return this.customers.removeFavorite(user.id, categoryId);
  }

  /* ------------------------------------------------- history & shortcuts */

  @Get('customers/me/recent-services')
  @AllowRestricted()
  recentServices(@CurrentUser() user: RequestUser) {
    return this.customers.recentServices(user.id);
  }

  @Get('customers/me/jobs')
  @AllowRestricted()
  jobs(
    @CurrentUser() user: RequestUser,
    @ZodQuery(customerJobsQuerySchema) query: CustomerJobsQuery,
  ) {
    return this.customers.listJobs(user.id, query);
  }

  @Get('customers/me/jobs/:id')
  @AllowRestricted()
  job(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.customers.getJob(user.id, id);
  }

  /** Returns a prefilled draft only — the app reviews it and calls POST /jobs itself (spec §175). */
  @Post('customers/me/reorder')
  reorder(@CurrentUser() user: RequestUser, @ZodBody(reorderSchema) input: ReorderBody) {
    return this.customers.reorder(user.id, input.jobId);
  }
}
