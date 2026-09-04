import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { PushMessage, PushProvider, PushResult } from './push.provider';

@Injectable()
export class ConsolePushProvider implements PushProvider {
  readonly name = 'console';
  constructor(private readonly logger: PinoLogger) {}
  async send(message: PushMessage): Promise<PushResult> {
    this.logger.info(
      { tokens: message.tokens.length, title: message.title, data: message.data },
      '[DEV PUSH]',
    );
    return { sent: message.tokens.length, failed: 0, invalidTokens: [] };
  }
}
