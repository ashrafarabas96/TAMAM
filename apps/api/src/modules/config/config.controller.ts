import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import {
  type UpdateConfigInput,
  type UpdateFeatureFlagInput,
  updateConfigSchema,
  updateFeatureFlagSchema,
} from '@tamam/validation';

import {
  CurrentUser,
  Public,
  RequestId,
  RequirePermission,
  ZodBody,
} from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-user';

import { SystemConfigService } from './system-config.service';

@ApiTags('config')
@Controller()
export class ConfigController {
  constructor(private readonly config: SystemConfigService) {}

  /** Mobile apps read enabled features at startup (authenticated when possible for rollout targeting). */
  @Public()
  @Get('config/feature-flags')
  publicFlags(@CurrentUser() user: RequestUser | undefined) {
    return this.config.publicFlags(user?.id);
  }

  @ApiBearerAuth()
  @Get('admin/config')
  @RequirePermission(Permission.CONFIG_READ)
  list() {
    return this.config.listConfigs();
  }

  @ApiBearerAuth()
  @Patch('admin/config')
  @RequirePermission(Permission.CONFIG_MANAGE)
  update(
    @ZodBody(updateConfigSchema) input: UpdateConfigInput,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.config.updateConfig(input, user.id, requestId);
  }

  @ApiBearerAuth()
  @Get('admin/feature-flags')
  @RequirePermission(Permission.CONFIG_READ)
  listFlags() {
    return this.config.listFlags();
  }

  @ApiBearerAuth()
  @Patch('admin/feature-flags/:key')
  @RequirePermission(Permission.FEATURE_FLAGS_MANAGE)
  updateFlag(
    @Param('key') key: string,
    @ZodBody(updateFeatureFlagSchema) input: UpdateFeatureFlagInput,
    @CurrentUser() user: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.config.updateFlag(key, input, user.id, requestId);
  }
}
