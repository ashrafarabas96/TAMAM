import { Module } from '@nestjs/common';

import { MediaUrlService } from './media-url.service';
import { MediaController } from './media.controller';
import { MediaProcessor } from './media.processor';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaUrlService, MediaProcessor],
  exports: [MediaService, MediaUrlService],
})
export class MediaModule {}
