import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Support tickets, ticket conversations and user reports (spec §63). */
@Module({
  imports: [MediaModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
