import { Global, Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Global()
@Module({
  imports: [MediaModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
