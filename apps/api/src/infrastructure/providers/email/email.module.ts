import { Injectable, Module } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AppConfigService } from '../../../config';
import { EMAIL_PROVIDER, type EmailMessage, type EmailProvider } from './email.provider';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  constructor(private readonly logger: Logger) {}
  async send(message: EmailMessage): Promise<{ accepted: boolean; providerRef: string | null }> {
    this.logger.info({ to: message.to, subject: message.subject }, '[DEV EMAIL]');
    return { accepted: true, providerRef: `console-${Date.now()}` };
  }
}

/**
 * SMTP adapter implemented with a minimal SMTP client over TLS (no extra dependency).
 * SMTP_URL format: smtps://user:pass@host:465  (implicit TLS)
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly url: URL;
  constructor(config: AppConfigService, private readonly logger: Logger) {
    this.url = new URL(config.env.SMTP_URL ?? 'smtps://localhost:465');
  }

  async send(message: EmailMessage): Promise<{ accepted: boolean; providerRef: string | null }> {
    const tls = await import('node:tls');
    const from = decodeURIComponent(this.url.username);
    const pass = decodeURIComponent(this.url.password);
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: this.url.hostname, port: Number(this.url.port || 465), servername: this.url.hostname }, () => undefined);
      let buffer = '';
      const steps = [
        `EHLO tamam.app`,
        `AUTH LOGIN`,
        Buffer.from(from).toString('base64'),
        Buffer.from(pass).toString('base64'),
        `MAIL FROM:<${from}>`,
        `RCPT TO:<${message.to}>`,
        `DATA`,
        `From: TAMAM <${from}>\r\nTo: <${message.to}>\r\nSubject: ${message.subject}\r\nMIME-Version: 1.0\r\nContent-Type: ${message.html ? 'text/html' : 'text/plain'}; charset=UTF-8\r\n\r\n${message.html ?? message.text}\r\n.`,
        `QUIT`,
      ];
      let step = -1;
      const next = () => {
        step += 1;
        if (step < steps.length) socket.write(`${steps[step]}\r\n`);
      };
      socket.setTimeout(15000, () => { socket.destroy(); reject(new Error('SMTP timeout')); });
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        if (!/\r\n$/.test(buffer)) return;
        const code = Number(buffer.slice(0, 3));
        buffer = '';
        if (code >= 400) { socket.destroy(); reject(new Error(`SMTP error ${code}`)); return; }
        if (step === steps.length - 1) { socket.end(); resolve({ accepted: true, providerRef: null }); return; }
        next();
      });
      socket.on('error', (err) => { this.logger.warn({ err }, 'SMTP error'); reject(err); });
    });
  }
}

@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [AppConfigService, Logger],
      useFactory: (config: AppConfigService, logger: Logger) => (config.env.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider(config, logger) : new ConsoleEmailProvider(logger)),
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
