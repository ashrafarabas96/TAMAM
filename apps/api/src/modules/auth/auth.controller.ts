import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AdminChangePasswordInput, type AdminLoginInput, type LogoutInput, type RefreshTokenInput, type RequestOtpInput, type VerifyOtpInput, adminChangePasswordSchema, adminLoginSchema, logoutSchema, refreshTokenSchema, requestOtpSchema, verifyOtpSchema } from '@tamam/validation';

import { AllowRestricted, ClientIp, CurrentUser, DeviceId, Public, RateLimit, UserAgent, ZodBody } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @RateLimit({ name: 'otp-request', limit: 5, windowSeconds: 600, keyBy: 'ip' })
  requestOtp(@ZodBody(requestOtpSchema) input: RequestOtpInput, @ClientIp() ip: string | null, @DeviceId() deviceId: string | null) {
    return this.auth.requestOtp(input, ip, deviceId);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @RateLimit({ name: 'otp-verify', limit: 10, windowSeconds: 600, keyBy: 'ip' })
  verifyOtp(@ZodBody(verifyOtpSchema) input: VerifyOtpInput, @ClientIp() ip: string | null, @UserAgent() ua: string | null) {
    return this.auth.verifyOtp(input, ip, ua);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @RateLimit({ name: 'refresh', limit: 30, windowSeconds: 600, keyBy: 'ip' })
  refresh(@ZodBody(refreshTokenSchema) input: RefreshTokenInput, @ClientIp() ip: string | null) {
    return this.auth.refresh(input, ip);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  @AllowRestricted()
  logout(@CurrentUser() user: RequestUser, @ZodBody(logoutSchema) input: LogoutInput) {
    return this.auth.logout(user.id, user.sessionId, input.all);
  }

  @Public()
  @Post('admin/login')
  @HttpCode(200)
  @RateLimit({ name: 'admin-login', limit: 10, windowSeconds: 900, keyBy: 'ip' })
  adminLogin(@ZodBody(adminLoginSchema) input: AdminLoginInput, @ClientIp() ip: string | null, @UserAgent() ua: string | null) {
    return this.auth.adminLogin(input, ip, ua);
  }

  @ApiBearerAuth()
  @Post('admin/change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: RequestUser, @ZodBody(adminChangePasswordSchema) input: AdminChangePasswordInput, @ClientIp() ip: string | null) {
    await this.auth.adminChangePassword(user.id, user.sessionId, input, ip);
    return { ok: true };
  }
}
