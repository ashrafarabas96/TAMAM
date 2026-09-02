import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_KEYS, ErrorCode, type RequestOtpResponse } from '@tamam/shared-types';
import { Logger } from 'nestjs-pino';

import { AppException } from '../../common/errors/app.exception';
import { hmacHash, randomDigits, safeEqual } from '../../common/utils/crypto.util';
import { addSeconds } from '../../common/utils/time';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SMS_PROVIDER, type SmsProvider } from '../../infrastructure/providers/sms/sms.provider';
import { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import { SystemConfigService } from '../config/system-config.service';
import { NotificationTemplateService } from '../notifications/notification-template.service';

/**
 * Phone OTP with expiry, attempt limits, resend cooldown, hourly caps and brute-force
 * protection (spec §10). Codes are stored only as HMAC hashes; they are never logged here.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly sysConfig: SystemConfigService,
    private readonly limiter: RateLimitService,
    private readonly templates: NotificationTemplateService,
    private readonly logger: Logger,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async request(phone: string, audience: 'CUSTOMER' | 'PARTNER', language: 'ar' | 'en', ip: string | null, deviceId: string | null): Promise<RequestOtpResponse> {
    const [length, ttl, maxAttempts, cooldown, maxPerHour] = await Promise.all([
      this.sysConfig.getNumber(CONFIG_KEYS.OTP_LENGTH),
      this.sysConfig.getNumber(CONFIG_KEYS.OTP_TTL_S),
      this.sysConfig.getNumber(CONFIG_KEYS.OTP_MAX_ATTEMPTS),
      this.sysConfig.getNumber(CONFIG_KEYS.OTP_RESEND_COOLDOWN_S),
      this.sysConfig.getNumber(CONFIG_KEYS.OTP_MAX_PER_HOUR),
    ]);

    // Resend cooldown
    const last = await this.prisma.otpRequest.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (last) {
      const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
      if (elapsed < cooldown) {
        throw new AppException(ErrorCode.OTP_RESEND_COOLDOWN, 'Please wait before requesting another code', 429, { retryAfterSeconds: Math.ceil(cooldown - elapsed) });
      }
    }
    // Hourly cap per phone + per IP
    const perPhone = await this.limiter.hit(`otp:phone:${phone}`, maxPerHour, 3600);
    if (!perPhone.allowed) throw AppException.rateLimited(perPhone.retryAfterSeconds);
    if (ip) {
      const perIp = await this.limiter.hit(`otp:ip:${ip}`, maxPerHour * 5, 3600);
      if (!perIp.allowed) throw AppException.rateLimited(perIp.retryAfterSeconds);
    }

    const code = randomDigits(length);
    const expiresAt = addSeconds(new Date(), ttl);
    await this.prisma.$transaction(async (tx) => {
      await tx.otpRequest.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } }); // invalidate previous
      await tx.otpRequest.create({ data: { phone, codeHash: hmacHash(code, this.config.env.OTP_PEPPER), audience, maxAttempts, expiresAt, ipAddress: ip, deviceId } });
    });

    const body = await this.templates.render('OTP_CODE', 'SMS', language, { code, minutes: String(Math.round(ttl / 60)) });
    try {
      await this.sms.send({ to: phone, body: body.body, category: 'OTP' });
    } catch (err) {
      this.logger.error({ err, phone: `${phone.slice(0, 6)}***` }, 'OTP SMS failed');
      throw AppException.external('sms', 'Could not send verification code. Try again shortly.');
    }

    return { resendAfterSeconds: cooldown, expiresInSeconds: ttl, ...(this.config.isProduction || this.sms.name !== 'console' ? {} : { devCode: code }) };
  }

  /** Verifies and consumes the latest active code. Throws typed errors; increments attempts on failure. */
  async verify(phone: string, code: string): Promise<{ audience: 'CUSTOMER' | 'PARTNER' }> {
    const otp = await this.prisma.otpRequest.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp) throw new AppException(ErrorCode.OTP_INVALID, 'Invalid or expired code', 400);
    if (otp.expiresAt < new Date()) throw new AppException(ErrorCode.OTP_EXPIRED, 'Code expired — request a new one', 400);
    if (otp.attempts >= otp.maxAttempts) throw new AppException(ErrorCode.OTP_TOO_MANY_ATTEMPTS, 'Too many attempts — request a new code', 429);

    const ok = safeEqual(otp.codeHash, hmacHash(code, this.config.env.OTP_PEPPER));
    if (!ok) {
      const updated = await this.prisma.otpRequest.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      if (updated.attempts >= updated.maxAttempts) {
        await this.prisma.otpRequest.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
        throw new AppException(ErrorCode.OTP_TOO_MANY_ATTEMPTS, 'Too many attempts — request a new code', 429);
      }
      throw new AppException(ErrorCode.OTP_INVALID, 'Invalid code', 400, { attemptsLeft: updated.maxAttempts - updated.attempts });
    }
    await this.prisma.otpRequest.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { audience: otp.audience as 'CUSTOMER' | 'PARTNER' };
  }
}
