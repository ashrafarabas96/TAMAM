import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { PartnerAvailabilityService } from './partner-availability.service';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [MediaModule, VehiclesModule],
  controllers: [PartnersController],
  providers: [PartnersService, PartnerAvailabilityService],
  exports: [PartnersService, PartnerAvailabilityService],
})
export class PartnersModule {}
