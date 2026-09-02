import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import type { SmsMessage, SmsProvider, SmsResult } from './sms.provider';

/**
 * Development-only provider: prints the message to the log. Refused in production by
 * env validation. OTP bodies are logged only here, never by the OTP service itself.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  constructor(private readonly logger: Logger) {}

  async send(message: SmsMessage): Promise<SmsResult> {
    this.logger.info({ to: message.to, category: message.category, body: message.body }, '[DEV SMS]');
    return { providerRef: `console-${Date.now()}`, accepted: true };
  }
}
