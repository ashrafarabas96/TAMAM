import { Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config';
import type { SmsMessage, SmsProvider, SmsResult } from './sms.provider';

/**
 * Generic HTTP gateway adapter (most regional SMS providers expose a JSON POST API).
 * Payload shape: { to, from, text }. Adapt in one place if the vendor differs.
 */
@Injectable()
export class HttpSmsProvider implements SmsProvider {
  readonly name = 'http';
  constructor(private readonly config: AppConfigService) {}

  async send(message: SmsMessage): Promise<SmsResult> {
    const { SMS_HTTP_URL, SMS_HTTP_TOKEN, SMS_SENDER_ID } = this.config.env;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(SMS_HTTP_URL as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${SMS_HTTP_TOKEN}` },
        body: JSON.stringify({ to: message.to, from: SMS_SENDER_ID, text: message.body }),
        signal: controller.signal,
      });
      if (!res.ok) throw AppException.external('sms', `SMS gateway responded ${res.status}`);
      const data = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string };
      return { providerRef: data.id ?? data.messageId ?? null, accepted: true };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw AppException.external('sms', err instanceof Error ? err.message : 'SMS send failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
