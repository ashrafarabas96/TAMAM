import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type MediaUploadIntentInput, mediaUploadIntentSchema } from '@tamam/validation';
import type { Response } from 'express';

import { AllowRestricted, CurrentUser, Public, RateLimit, ZodBody } from '../../common/decorators';
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
  intent(
    @CurrentUser() user: RequestUser,
    @ZodBody(mediaUploadIntentSchema) input: MediaUploadIntentInput,
  ) {
    return this.media.createUploadIntent(user, input);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @AllowRestricted()
  confirm(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.media.confirmUpload(user, id);
  }

  @Get(':id')
  @AllowRestricted()
  status(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.media.getStatus(user, id);
  }

  /// Streams a public object over the API's own port.
  ///
  /// Public media used to be addressed straight at the object store
  /// (`http://<host>:9000/...`). On one machine that is fine; from a phone it
  /// means a second host and a second open port, and the banner images simply
  /// never arrived. Serving them here keeps every request the app makes on one
  /// origin, so one reachable address is enough.
  @Get('public/*key')
  @Public()
  async publicObject(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const object = await this.media.readPublic(decodeURIComponent(key));
    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(object.body);
  }

  @Get(':key/view')
  @AllowRestricted()
  async view(@CurrentUser() user: RequestUser, @Param('key') key: string, @Res() res: Response) {
    const url = await this.media.resolveSigned(decodeURIComponent(key), user);
    res.redirect(302, url);
  }
}
