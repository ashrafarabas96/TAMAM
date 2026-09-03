import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, UserRole } from '@tamam/shared-types';
import { type RateJobInput, pageRequestSchema, rateJobSchema } from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, CurrentUser, RequireAnyPermission, RequireRole, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { RatingsService } from './ratings.service';

type PageQuery = z.infer<typeof pageRequestSchema>;

@ApiTags('ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /** Rate the other party of a completed job. Re-posting inside the edit window updates the review. */
  @Post('jobs/:id/rating')
  rate(@Param('id', UuidPipe) jobId: string, @CurrentUser() user: RequestUser, @ZodBody(rateJobSchema) input: RateJobInput) {
    return this.ratings.rate(user, jobId, input);
  }

  @Get('jobs/:id/rating')
  @AllowRestricted()
  getForJob(@Param('id', UuidPipe) jobId: string, @CurrentUser() user: RequestUser) {
    return this.ratings.getForJob(user, jobId);
  }

  @Get('partners/me/reviews')
  @RequireRole(UserRole.PARTNER)
  @AllowRestricted()
  myReviews(@CurrentUser() user: RequestUser, @ZodQuery(pageRequestSchema) query: PageQuery) {
    return this.ratings.listForUser(user.id, query.cursor, query.limit);
  }

  /* ---------------------------------------------------------------- admin */

  @Get('admin/users/:id/reviews')
  @RequireAnyPermission(Permission.CUSTOMERS_READ, Permission.PARTNERS_READ)
  userReviews(@Param('id', UuidPipe) userId: string, @ZodQuery(pageRequestSchema) query: PageQuery) {
    return this.ratings.listForUser(userId, query.cursor, query.limit);
  }
}
