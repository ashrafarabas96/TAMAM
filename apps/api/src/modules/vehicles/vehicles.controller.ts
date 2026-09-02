import { Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, VerificationStatus } from '@tamam/shared-types';
import {
  type PartnerDocumentUploadInput,
  type PartnerVehicleInput,
  type ReviewDocumentInput,
  pageRequestSchema,
  partnerDocumentUploadSchema,
  partnerVehicleSchema,
  reviewDocumentSchema,
  uuidSchema,
} from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, Audited, CurrentUser, RequestId, RequirePermission, RequireRole, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { VehiclesService } from './vehicles.service';

const adminVehicleListSchema = pageRequestSchema.extend({
  partnerId: uuidSchema.optional(),
  status: z.nativeEnum(VerificationStatus).optional(),
});
type AdminVehicleListQuery = z.infer<typeof adminVehicleListSchema>;

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller()
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  /* ------------------------------------------------------------- partner */

  @Get('partners/me/vehicles')
  @RequireRole('PARTNER')
  @AllowRestricted()
  list(@CurrentUser() user: RequestUser) {
    return this.vehicles.listForPartner(user.id);
  }

  @Get('partners/me/vehicles/:id')
  @RequireRole('PARTNER')
  @AllowRestricted()
  get(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.vehicles.getForPartner(user.id, id);
  }

  @Post('partners/me/vehicles')
  @RequireRole('PARTNER')
  create(@CurrentUser() user: RequestUser, @ZodBody(partnerVehicleSchema) input: PartnerVehicleInput) {
    return this.vehicles.create(user.id, input);
  }

  @Put('partners/me/vehicles/:id')
  @RequireRole('PARTNER')
  update(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(partnerVehicleSchema) input: PartnerVehicleInput) {
    return this.vehicles.update(user.id, id, input);
  }

  @Post('partners/me/vehicles/:id/activate')
  @RequireRole('PARTNER')
  activate(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.vehicles.activate(user.id, id);
  }

  @Get('partners/me/vehicles/:id/documents')
  @RequireRole('PARTNER')
  @AllowRestricted()
  listDocuments(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.vehicles.listDocuments(user.id, id);
  }

  @Post('partners/me/vehicles/:id/documents')
  @RequireRole('PARTNER')
  addDocument(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(partnerDocumentUploadSchema) input: PartnerDocumentUploadInput) {
    return this.vehicles.addDocument(user.id, id, input);
  }

  /* --------------------------------------------------------------- admin */

  @Get('admin/vehicles')
  @RequirePermission(Permission.PARTNERS_READ)
  adminList(@ZodQuery(adminVehicleListSchema) query: AdminVehicleListQuery) {
    return this.vehicles.adminList({ partnerId: query.partnerId, status: query.status, cursor: query.cursor, limit: query.limit });
  }

  @Get('admin/vehicles/:id')
  @RequirePermission(Permission.PARTNERS_READ)
  adminGet(@Param('id', UuidPipe) id: string) {
    return this.vehicles.adminGet(id);
  }

  @Post('admin/vehicles/:id/review')
  @RequirePermission(Permission.PARTNERS_REVIEW_DOCUMENTS)
  @Audited({ action: 'vehicle.review', entity: 'vehicle', entityIdFrom: 'id' })
  review(
    @Param('id', UuidPipe) id: string,
    @ZodBody(reviewDocumentSchema) input: ReviewDocumentInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.vehicles.reviewVehicle(id, input, actor, requestId);
  }

  @Post('admin/vehicles/:id/documents/:docId/review')
  @RequirePermission(Permission.PARTNERS_REVIEW_DOCUMENTS)
  @Audited({ action: 'vehicle_document.review', entity: 'vehicle_document', entityIdFrom: 'docId' })
  reviewDocument(
    @Param('id', UuidPipe) id: string,
    @Param('docId', UuidPipe) docId: string,
    @ZodBody(reviewDocumentSchema) input: ReviewDocumentInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.vehicles.reviewVehicleDocument(id, docId, input, actor, requestId);
  }
}
