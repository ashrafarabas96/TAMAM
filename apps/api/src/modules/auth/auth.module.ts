import { Global, Module, forwardRef } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [forwardRef(() => UsersModule), NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, SessionService],
  exports: [TokenService, SessionService, AuthService],
})
export class AuthModule {}
