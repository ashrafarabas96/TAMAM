import type { ServiceCategoryDto, ServiceSubcategoryDto, ServiceOptionDto, ServiceTypeDto, VehicleTypeDto } from '@tamam/shared-types';
import type { UpsertPackageCategoryInput, UpsertServiceCategoryInput, UpsertServiceOptionInput, UpsertServiceSubcategoryInput, UpsertVehicleTypeInput } from '@tamam/validation';

import { api } from '@/lib/api';

export interface PackageCategoryDto {
  id: string;
  code: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string } | null;
  maxWeightKg: number | null;
  requiresVehicleTypeIds: string[];
  isFragile: boolean;
  isProhibited: boolean;
  sortOrder: number;
  isActive: boolean;
}

export const catalogApi = {
  serviceTypes: () => api.get<ServiceTypeDto[]>('/catalog/service-types'),
  adminCategories: () => api.get<ServiceCategoryDto[]>('/admin/catalog/categories'),
  createCategory: (input: UpsertServiceCategoryInput) => api.post<ServiceCategoryDto>('/admin/catalog/categories', input),
  updateCategory: (id: string, input: UpsertServiceCategoryInput) => api.put<ServiceCategoryDto>(`/admin/catalog/categories/${id}`, input),
  createSubcategory: (input: UpsertServiceSubcategoryInput) => api.post<ServiceSubcategoryDto>('/admin/catalog/subcategories', input),
  updateSubcategory: (id: string, input: UpsertServiceSubcategoryInput) => api.put<ServiceSubcategoryDto>(`/admin/catalog/subcategories/${id}`, input),
  createOption: (input: UpsertServiceOptionInput) => api.post<ServiceOptionDto>('/admin/catalog/options', input),
  updateOption: (id: string, input: UpsertServiceOptionInput) => api.put<ServiceOptionDto>(`/admin/catalog/options/${id}`, input),
  adminVehicleTypes: () => api.get<VehicleTypeDto[]>('/admin/catalog/vehicle-types'),
  createVehicleType: (input: UpsertVehicleTypeInput) => api.post<VehicleTypeDto>('/admin/catalog/vehicle-types', input),
  updateVehicleType: (id: string, input: UpsertVehicleTypeInput) => api.put<VehicleTypeDto>(`/admin/catalog/vehicle-types/${id}`, input),
  adminPackageCategories: () => api.get<PackageCategoryDto[]>('/admin/catalog/package-categories'),
  createPackageCategory: (input: UpsertPackageCategoryInput) => api.post<PackageCategoryDto>('/admin/catalog/package-categories', input),
  updatePackageCategory: (id: string, input: UpsertPackageCategoryInput) => api.put<PackageCategoryDto>(`/admin/catalog/package-categories/${id}`, input),
};
