import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type SendMessageInput, markReadSchema, pageRequestSchema, sendMessageSchema } from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, CurrentUser, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { ChatService } from './chat.service';

type PageQuery = z.infer<typeof pageRequestSchema>;
type MarkReadBody = z.infer<typeof markReadSchema>;

/**
 * HTTP fallback for the chat namespace: the apps use WebSockets when connected and these
 * endpoints on cold start or when the socket is down. Authorization is object-level
 * (`JobPolicy.canChat`) so job parties and support agents share one route.
 */
@ApiTags('chat')
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('jobs/:id/chat/messages')
  @AllowRestricted()
  listMessages(@Param('id', UuidPipe) jobId: string, @CurrentUser() user: RequestUser, @ZodQuery(pageRequestSchema) query: PageQuery) {
    return this.chat.listMessages(user, jobId, query.cursor, query.limit);
  }

  @Post('jobs/:id/chat/messages')
  @AllowRestricted()
  send(@Param('id', UuidPipe) jobId: string, @CurrentUser() user: RequestUser, @ZodBody(sendMessageSchema) input: SendMessageInput) {
    return this.chat.send(user, jobId, input);
  }

  @Post('jobs/:id/chat/read')
  @HttpCode(200)
  @AllowRestricted()
  markRead(@Param('id', UuidPipe) jobId: string, @CurrentUser() user: RequestUser, @ZodBody(markReadSchema) input: MarkReadBody) {
    return this.chat.markRead(user, jobId, input.upToMessageId);
  }
}
