import { Controller, Get, Headers, HttpCode, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type MediaUploadIntentInput, mediaUploadIntentSchema } from '@tamam/validation';
import type { Request, Response } from 'express';

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

  /// Receives the upload body over the API's own origin (see MediaService.receiveUpload).
  /// The raw parser for this path is registered in main.ts, so `req.body` is the bytes.
  @Put(':id/upload')
  @HttpCode(200)
  @AllowRestricted()
  @RateLimit({ name: 'media-upload', limit: 60, windowSeconds: 600, keyBy: 'user' })
  upload(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidPipe) id: string,
    @Headers('content-type') contentType: string | undefined,
    @Req() req: Request,
  ) {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    return this.media.receiveUpload(user, id, body, contentType);
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
  // Unauthenticated and serves bytes, so it is the one route that could be used
  // to pull bandwidth. Generous for an app screen full of images, tight for a script.
  @RateLimit({ name: 'media-public', limit: 300, windowSeconds: 600, keyBy: 'ip' })
  async publicObject(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const object = await this.media.readPublic(decodeURIComponent(key));
    res.setHeader('Content-Type', object.contentType);
    // The stored type is trusted over the bytes: never let a browser sniff a
    // stored object into a scriptable type.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
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
