import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type MediaUploadIntentInput, mediaUploadIntentSchema } from '@tamam/validation';
import type { Response } from 'express';

import { AllowRestricted, CurrentUser, RateLimit, ZodBody } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-intents')
  @AllowRestricted()
  @RateLimit({ name: 'media-intent', limit: 60, windowSeconds: 600, keyBy: 'user' })
  intent(@CurrentUser() user: RequestUser, @ZodBody(mediaUploadIntentSchema) input: MediaUploadIntentInput) {
    return this.media.createUploadIntent(user, input);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @AllowRestricted()
  confirm(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.media.confirmUpload(user, id);
  }

  @Get(':key/view')
  @AllowRestricted()
  async view(@CurrentUser() user: RequestUser, @Param('key') key: string, @Res() res: Response) {
    const url = await this.media.resolveSigned(decodeURIComponent(key), user);
    res.redirect(302, url);
  }
}
