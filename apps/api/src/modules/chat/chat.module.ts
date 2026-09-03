import { Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';

import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/**
 * In-job chat (spec §60) and the `/chat` WebSocket namespace. `ChatService` and `ChatGateway`
 * reference each other (the service broadcasts, the gateway delegates sends), so both sides use
 * `forwardRef` in their constructors.
 */
@Module({
  imports: [MediaModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
