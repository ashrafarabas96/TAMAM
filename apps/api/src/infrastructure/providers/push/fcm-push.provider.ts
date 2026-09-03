import { createSign } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AppConfigService } from '../../../config';

import type { PushMessage, PushProvider, PushResult } from './push.provider';

interface ServiceAccount { client_email: string; private_key: string; project_id: string; token_uri?: string }

/**
 * Firebase Cloud Messaging HTTP v1 adapter without the heavy admin SDK:
 * signs a JWT with the service account, exchanges it for an OAuth2 token (cached),
 * and sends one message per token (FCM v1 has no multicast endpoint).
 */
@Injectable()
export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';
  private readonly account: ServiceAccount;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    config: AppConfigService,
    private readonly logger: PinoLogger,
  ) {
    const raw = Buffer.from(config.env.FCM_SERVICE_ACCOUNT_JSON ?? '', 'base64').toString('utf8');
    this.account = JSON.parse(raw) as ServiceAccount;
  }

  async send(message: PushMessage): Promise<PushResult> {
    const token = await this.getAccessToken();
    const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
    await Promise.all(
      message.tokens.map(async (deviceToken) => {
        const body = {
          message: {
            token: deviceToken,
            notification: { title: message.title, body: message.body },
            data: message.data ?? {},
            android: { priority: message.priority === 'high' ? 'HIGH' : 'NORMAL', ttl: `${message.ttlSeconds ?? 3600}s`, collapse_key: message.collapseKey, notification: { channel_id: message.priority === 'high' ? 'tamam_urgent' : 'tamam_default', sound: 'default' } },
            apns: { headers: { 'apns-priority': message.priority === 'high' ? '10' : '5', ...(message.collapseKey ? { 'apns-collapse-id': message.collapseKey } : {}) }, payload: { aps: { sound: 'default', 'content-available': 1 } } },
          },
        };
        try {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            result.sent += 1;
          } else {
            result.failed += 1;
            const text = await res.text();
            if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) result.invalidTokens.push(deviceToken);
            else this.logger.warn({ status: res.status, text: text.slice(0, 300) }, 'FCM send failed');
          }
        } catch (err) {
          result.failed += 1;
          this.logger.warn({ err }, 'FCM request error');
        }
      }),
    );
    return result;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({ iss: this.account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
    ).toString('base64url');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const signature = signer.sign(this.account.private_key, 'base64url');
    const assertion = `${header}.${claims}.${signature}`;
    const res = await fetch(this.account.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}
