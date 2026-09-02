import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import { type AuditListFilterInput, auditListFilterSchema } from '@tamam/validation';

import { RequirePermission, ZodQuery } from '../../common/decorators';
import { AuditService } from './audit.service';

@ApiTags('admin/audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission(Permission.AUDIT_READ)
  list(@ZodQuery(auditListFilterSchema) filter: AuditListFilterInput) {
    return this.audit.list(filter);
  }
}
