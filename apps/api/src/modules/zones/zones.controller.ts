import { Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type UpsertServiceZoneInput, type ZoneServiceRuleInput, upsertServiceZoneSchema, zoneServiceRuleSchema } from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, Audited, CurrentUser, Public, RequestId, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { ZonesService } from './zones.service';

const pointSchema = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

@ApiTags('zones')
@Controller()
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Public()
  @Get('zones')
  listPublic() {
    return this.zones.listPublic();
  }

  /** Apps call this on location change to know whether service exists here (spec §74). */
  @Public()
  @Get('zones/resolve')
  @AllowRestricted()
  async resolve(@ZodQuery(pointSchema) q: { lat: number; lng: number }) {
    const zone = await this.zones.resolveZoneForPoint(q.lat, q.lng);
    return { inServiceArea: !!zone, zone };
  }

  @ApiBearerAuth()
  @Get('admin/zones')
  @RequirePermission(Permission.ZONES_READ)
  listAll() {
    return this.zones.listAll();
  }

  @ApiBearerAuth()
  @Get('admin/zones/:id')
  @RequirePermission(Permission.ZONES_READ)
  get(@Param('id', UuidPipe) id: string) {
    return this.zones.getById(id);
  }

  @ApiBearerAuth()
  @Post('admin/zones')
  @RequirePermission(Permission.ZONES_MANAGE)
  create(@ZodBody(upsertServiceZoneSchema) input: UpsertServiceZoneInput, @CurrentUser() user: RequestUser, @RequestId() requestId: string) {
    return this.zones.upsert(null, input, user.id, requestId);
  }

  @ApiBearerAuth()
  @Put('admin/zones/:id')
  @RequirePermission(Permission.ZONES_MANAGE)
  update(@Param('id', UuidPipe) id: string, @ZodBody(upsertServiceZoneSchema) input: UpsertServiceZoneInput, @CurrentUser() user: RequestUser, @RequestId() requestId: string) {
    return this.zones.upsert(id, input, user.id, requestId);
  }

  @ApiBearerAuth()
  @Get('admin/zones/:id/rules')
  @RequirePermission(Permission.ZONES_READ)
  rules(@Param('id', UuidPipe) id: string) {
    return this.zones.listRules(id);
  }

  @ApiBearerAuth()
  @Put('admin/zones/rules')
  @RequirePermission(Permission.ZONES_MANAGE)
  @Audited({ action: 'zone.rule', entity: 'zone_service_rule' })
  upsertRule(@ZodBody(zoneServiceRuleSchema) input: ZoneServiceRuleInput, @CurrentUser() user: RequestUser, @RequestId() requestId: string) {
    return this.zones.upsertRule(input, user.id, requestId);
  }
}
