import { Module } from '@nestjs/common';

import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

/** Two-way ratings and the cached profile aggregates they feed (spec §59). */
@Module({
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
