import { Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobType, Permission } from '@tamam/shared-types';
import { type SearchServicesInput, type UpsertPackageCategoryInput, type UpsertServiceCategoryInput, type UpsertServiceOptionInput, type UpsertServiceSubcategoryInput, type UpsertVehicleTypeInput, searchServicesSchema, upsertPackageCategorySchema, upsertServiceCategorySchema, upsertServiceOptionSchema, upsertServiceSubcategorySchema, upsertVehicleTypeSchema } from '@tamam/validation';
import { z } from 'zod';

import { AllowRestricted, CurrentUser, Public, RequestId, RequirePermission, ZodBody, ZodQuery } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { CatalogService } from './catalog.service';

const categoriesQuery = z.object({ jobType: z.nativeEnum(JobType).optional(), zoneId: z.string().uuid().optional() });

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('catalog/service-types')
  serviceTypes(@CurrentUser() user: RequestUser | undefined, @ZodQuery(categoriesQuery) q: { zoneId?: string }) {
    return this.catalog.listServiceTypes(user?.id, q.zoneId ?? null);
  }

  @Public()
  @Get('catalog/categories')
  categories(@ZodQuery(categoriesQuery) q: { jobType?: JobType; zoneId?: string }) {
    return this.catalog.listCategories(q.jobType, q.zoneId ?? null);
  }

  @Public()
  @Get('catalog/categories/:id')
  category(@Param('id', UuidPipe) id: string) {
    return this.catalog.getCategoryDto(id);
  }

  @Public()
  @Get('catalog/vehicle-types')
  vehicleTypes(@ZodQuery(categoriesQuery) q: { jobType?: JobType }) {
    return this.catalog.listVehicleTypes(q.jobType);
  }

  @Public()
  @Get('catalog/package-categories')
  packageCategories() {
    return this.catalog.listPackageCategories();
  }

  @Public()
  @Get('catalog/search')
  @AllowRestricted()
  search(@ZodQuery(searchServicesSchema) q: SearchServicesInput, @CurrentUser() user: RequestUser | undefined) {
    return this.catalog.search(q, user?.id);
  }

  /* ---------------------------------------------------------------- admin */
  @ApiBearerAuth() @Get('admin/catalog/categories') @RequirePermission(Permission.SERVICES_READ)
  adminCategories() { return this.catalog.listCategoriesAdmin(); }

  @ApiBearerAuth() @Post('admin/catalog/categories') @RequirePermission(Permission.SERVICES_MANAGE)
  createCategory(@ZodBody(upsertServiceCategorySchema) input: UpsertServiceCategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertCategory(null, input, u.id, rid); }

  @ApiBearerAuth() @Put('admin/catalog/categories/:id') @RequirePermission(Permission.SERVICES_MANAGE)
  updateCategory(@Param('id', UuidPipe) id: string, @ZodBody(upsertServiceCategorySchema) input: UpsertServiceCategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertCategory(id, input, u.id, rid); }

  @ApiBearerAuth() @Post('admin/catalog/subcategories') @RequirePermission(Permission.SERVICES_MANAGE)
  createSub(@ZodBody(upsertServiceSubcategorySchema) input: UpsertServiceSubcategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertSubcategory(null, input, u.id, rid); }

  @ApiBearerAuth() @Put('admin/catalog/subcategories/:id') @RequirePermission(Permission.SERVICES_MANAGE)
  updateSub(@Param('id', UuidPipe) id: string, @ZodBody(upsertServiceSubcategorySchema) input: UpsertServiceSubcategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertSubcategory(id, input, u.id, rid); }

  @ApiBearerAuth() @Post('admin/catalog/options') @RequirePermission(Permission.SERVICES_MANAGE)
  createOption(@ZodBody(upsertServiceOptionSchema) input: UpsertServiceOptionInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertOption(null, input, u.id, rid); }

  @ApiBearerAuth() @Put('admin/catalog/options/:id') @RequirePermission(Permission.SERVICES_MANAGE)
  updateOption(@Param('id', UuidPipe) id: string, @ZodBody(upsertServiceOptionSchema) input: UpsertServiceOptionInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertOption(id, input, u.id, rid); }

  @ApiBearerAuth() @Get('admin/catalog/vehicle-types') @RequirePermission(Permission.SERVICES_READ)
  adminVehicleTypes() { return this.catalog.listVehicleTypes(undefined, true); }

  @ApiBearerAuth() @Post('admin/catalog/vehicle-types') @RequirePermission(Permission.SERVICES_MANAGE)
  createVehicleType(@ZodBody(upsertVehicleTypeSchema) input: UpsertVehicleTypeInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertVehicleType(null, input, u.id, rid); }

  @ApiBearerAuth() @Put('admin/catalog/vehicle-types/:id') @RequirePermission(Permission.SERVICES_MANAGE)
  updateVehicleType(@Param('id', UuidPipe) id: string, @ZodBody(upsertVehicleTypeSchema) input: UpsertVehicleTypeInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertVehicleType(id, input, u.id, rid); }

  @ApiBearerAuth() @Get('admin/catalog/package-categories') @RequirePermission(Permission.SERVICES_READ)
  adminPackageCategories() { return this.catalog.listPackageCategories(true); }

  @ApiBearerAuth() @Post('admin/catalog/package-categories') @RequirePermission(Permission.SERVICES_MANAGE)
  createPackageCategory(@ZodBody(upsertPackageCategorySchema) input: UpsertPackageCategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertPackageCategory(null, input, u.id, rid); }

  @ApiBearerAuth() @Put('admin/catalog/package-categories/:id') @RequirePermission(Permission.SERVICES_MANAGE)
  updatePackageCategory(@Param('id', UuidPipe) id: string, @ZodBody(upsertPackageCategorySchema) input: UpsertPackageCategoryInput, @CurrentUser() u: RequestUser, @RequestId() rid: string) { return this.catalog.upsertPackageCategory(id, input, u.id, rid); }
}
