import 'package:flutter/material.dart' show Color;
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/features/catalog/domain/dynamic_field.dart';

/// One of the four top-level services (`ServiceTypeDto`).
class ServiceType {
  const ServiceType({
    required this.id,
    required this.code,
    required this.name,
    required this.colorHex,
    required this.sortOrder,
    this.description,
    this.iconUrl,
  });

  factory ServiceType.fromJson(JsonMap json) => ServiceType(
        id: readStringOr(json, 'id', ''),
        code: JobType.fromValue(readString(json, 'code')) ?? JobType.ride,
        name: LocalizedText.required(json, 'name'),
        colorHex: readStringOr(json, 'colorHex', '#5D3EBC'),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
      );

  final String id;
  final JobType code;
  final LocalizedText name;
  final String colorHex;
  final int sortOrder;
  final LocalizedText? description;
  final String? iconUrl;

  /// The brand colour for this service; falls back to the token palette when
  /// the operator has not set one.
  Color get color => parseHexColor(colorHex) ?? serviceColorFor(code);
}

/// Media the category requires before a job can be created.
class RequiredMedia {
  const RequiredMedia({
    required this.images,
    required this.video,
    required this.audio,
    required this.minImages,
    required this.maxImages,
  });

  factory RequiredMedia.fromJson(JsonMap json) => RequiredMedia(
        images: readBoolOr(json, 'images', false),
        video: readBoolOr(json, 'video', false),
        audio: readBoolOr(json, 'audio', false),
        minImages: readIntOr(json, 'minImages', 0),
        maxImages: readIntOr(json, 'maxImages', 6),
      );

  const RequiredMedia.none()
      : images = false,
        video = false,
        audio = false,
        minImages = 0,
        maxImages = 6;

  final bool images;
  final bool video;
  final bool audio;
  final int minImages;
  final int maxImages;
}

/// How the job progresses after the partner arrives.
class WorkflowConfig {
  const WorkflowConfig({
    required this.skipInspection,
    required this.requiresQuote,
    required this.requiresCustomerConfirmation,
    required this.autoConfirmHours,
  });

  factory WorkflowConfig.fromJson(JsonMap json) => WorkflowConfig(
        skipInspection: readBoolOr(json, 'skipInspection', false),
        requiresQuote: readBoolOr(json, 'requiresQuote', true),
        requiresCustomerConfirmation: readBoolOr(json, 'requiresCustomerConfirmation', true),
        autoConfirmHours: readIntOr(json, 'autoConfirmHours', 24),
      );

  const WorkflowConfig.standard()
      : skipInspection = false,
        requiresQuote = true,
        requiresCustomerConfirmation = true,
        autoConfirmHours = 24;

  final bool skipInspection;
  final bool requiresQuote;
  final bool requiresCustomerConfirmation;
  final int autoConfirmHours;
}

/// A priced add-on inside a subcategory (`ServiceOptionDto`).
class ServiceOption {
  const ServiceOption({required this.id, required this.name, required this.price});

  factory ServiceOption.fromJson(JsonMap json) => ServiceOption(
        id: readStringOr(json, 'id', ''),
        name: LocalizedText.required(json, 'name'),
        price: readObject<Money>(json, 'price', Money.fromJson) ?? const Money.zero('ILS'),
      );

  final String id;
  final LocalizedText name;
  final Money price;
}

/// A specific job inside a category, e.g. "تركيب سخان" (`ServiceSubcategoryDto`).
class ServiceSubcategory {
  const ServiceSubcategory({
    required this.id,
    required this.categoryId,
    required this.slug,
    required this.name,
    required this.sortOrder,
    this.description,
    this.iconUrl,
    this.fixedPrice,
    this.startingFrom,
    this.estimatedDurationMin,
    this.options = const <ServiceOption>[],
  });

  factory ServiceSubcategory.fromJson(JsonMap json) => ServiceSubcategory(
        id: readStringOr(json, 'id', ''),
        categoryId: readStringOr(json, 'categoryId', ''),
        slug: readStringOr(json, 'slug', ''),
        name: LocalizedText.required(json, 'name'),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
        fixedPrice: readObject<Money>(json, 'fixedPrice', Money.fromJson),
        startingFrom: readObject<Money>(json, 'startingFrom', Money.fromJson),
        estimatedDurationMin: readInt(json, 'estimatedDurationMin'),
        options: readList<ServiceOption>(json, 'options', ServiceOption.fromJson),
      );

  final String id;
  final String categoryId;
  final String slug;
  final LocalizedText name;
  final int sortOrder;
  final LocalizedText? description;
  final String? iconUrl;
  final Money? fixedPrice;
  final Money? startingFrom;
  final int? estimatedDurationMin;
  final List<ServiceOption> options;
}

/// A bookable service category (`ServiceCategoryDto`).
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.serviceTypeId,
    required this.jobType,
    required this.slug,
    required this.name,
    required this.pricingMethod,
    required this.requiredFields,
    required this.requiredMedia,
    required this.workflowConfig,
    required this.allowsInstant,
    required this.allowsScheduled,
    required this.urgencyLevels,
    required this.isFeatured,
    required this.sortOrder,
    this.description,
    this.iconUrl,
    this.imageUrl,
    this.colorHex,
    this.inspectionFee,
    this.startingFrom,
    this.hourlyRate,
    this.fixedPrice,
    this.subcategories = const <ServiceSubcategory>[],
  });

  factory ServiceCategory.fromJson(JsonMap json) => ServiceCategory(
        id: readStringOr(json, 'id', ''),
        serviceTypeId: readStringOr(json, 'serviceTypeId', ''),
        jobType: JobType.fromValue(readString(json, 'jobType')) ?? JobType.homeService,
        slug: readStringOr(json, 'slug', ''),
        name: LocalizedText.required(json, 'name'),
        pricingMethod: PricingMethod.fromValue(readString(json, 'pricingMethod')) ?? PricingMethod.inspectionQuote,
        requiredFields: readList<DynamicField>(json, 'requiredFields', DynamicField.fromJson)
          ..sort((DynamicField a, DynamicField b) => a.sortOrder.compareTo(b.sortOrder)),
        requiredMedia:
            readObject<RequiredMedia>(json, 'requiredMedia', RequiredMedia.fromJson) ?? const RequiredMedia.none(),
        workflowConfig:
            readObject<WorkflowConfig>(json, 'workflowConfig', WorkflowConfig.fromJson) ?? const WorkflowConfig.standard(),
        allowsInstant: readBoolOr(json, 'allowsInstant', true),
        allowsScheduled: readBoolOr(json, 'allowsScheduled', true),
        urgencyLevels: readStringList(json, 'urgencyLevels')
            .map(JobUrgency.fromValue)
            .whereType<JobUrgency>()
            .toList(growable: false),
        isFeatured: readBoolOr(json, 'isFeatured', false),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
        imageUrl: readString(json, 'imageUrl'),
        colorHex: readString(json, 'colorHex'),
        inspectionFee: readObject<Money>(json, 'inspectionFee', Money.fromJson),
        startingFrom: readObject<Money>(json, 'startingFrom', Money.fromJson),
        hourlyRate: readObject<Money>(json, 'hourlyRate', Money.fromJson),
        fixedPrice: readObject<Money>(json, 'fixedPrice', Money.fromJson),
        subcategories: readList<ServiceSubcategory>(json, 'subcategories', ServiceSubcategory.fromJson),
      );

  final String id;
  final String serviceTypeId;
  final JobType jobType;
  final String slug;
  final LocalizedText name;
  final PricingMethod pricingMethod;
  final List<DynamicField> requiredFields;
  final RequiredMedia requiredMedia;
  final WorkflowConfig workflowConfig;
  final bool allowsInstant;
  final bool allowsScheduled;
  final List<JobUrgency> urgencyLevels;
  final bool isFeatured;
  final int sortOrder;
  final LocalizedText? description;
  final String? iconUrl;
  final String? imageUrl;
  final String? colorHex;
  final Money? inspectionFee;
  final Money? startingFrom;
  final Money? hourlyRate;
  final Money? fixedPrice;
  final List<ServiceSubcategory> subcategories;

  Color get color => parseHexColor(colorHex) ?? serviceColorFor(jobType);

  /// Inspection-first categories charge a visit fee and quote afterwards.
  bool get needsInspection =>
      pricingMethod == PricingMethod.inspectionQuote && !workflowConfig.skipInspection;
}

/// A delivery package type (`GET /catalog/package-categories`).
class PackageCategory {
  const PackageCategory({
    required this.id,
    required this.code,
    required this.name,
    required this.isFragile,
    required this.isProhibited,
    required this.sortOrder,
    this.description,
    this.maxWeightKg,
  });

  factory PackageCategory.fromJson(JsonMap json) => PackageCategory(
        id: readStringOr(json, 'id', ''),
        code: readStringOr(json, 'code', ''),
        name: LocalizedText.required(json, 'name'),
        isFragile: readBoolOr(json, 'isFragile', false),
        isProhibited: readBoolOr(json, 'isProhibited', false),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        description: LocalizedText.maybe(json, 'description'),
        maxWeightKg: readDouble(json, 'maxWeightKg'),
      );

  final String id;
  final String code;
  final LocalizedText name;
  final bool isFragile;
  final bool isProhibited;
  final int sortOrder;
  final LocalizedText? description;
  final double? maxWeightKg;
}

/// A vehicle class offered for rides and deliveries (`VehicleTypeDto`).
class VehicleType {
  const VehicleType({
    required this.id,
    required this.code,
    required this.name,
    required this.seats,
    required this.allowedJobTypes,
    required this.sortOrder,
    this.description,
    this.iconUrl,
    this.cargoCapacityKg,
  });

  factory VehicleType.fromJson(JsonMap json) => VehicleType(
        id: readStringOr(json, 'id', ''),
        code: readStringOr(json, 'code', ''),
        name: LocalizedText.required(json, 'name'),
        seats: readIntOr(json, 'seats', 4),
        allowedJobTypes: readStringList(json, 'allowedJobTypes')
            .map(JobType.fromValue)
            .whereType<JobType>()
            .toList(growable: false),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
        cargoCapacityKg: readDouble(json, 'cargoCapacityKg'),
      );

  final String id;
  final String code;
  final LocalizedText name;
  final int seats;
  final List<JobType> allowedJobTypes;
  final int sortOrder;
  final LocalizedText? description;
  final String? iconUrl;
  final double? cargoCapacityKg;
}

/// A hit from `GET /catalog/search`.
class CatalogSearchHit {
  const CatalogSearchHit({
    required this.categoryId,
    required this.name,
    required this.categoryName,
    required this.jobType,
    required this.score,
    this.subcategoryId,
    this.iconUrl,
  });

  factory CatalogSearchHit.fromJson(JsonMap json) => CatalogSearchHit(
        categoryId: readStringOr(json, 'categoryId', ''),
        name: LocalizedText.required(json, 'name'),
        categoryName: LocalizedText.required(json, 'categoryName'),
        jobType: JobType.fromValue(readString(json, 'jobType')) ?? JobType.homeService,
        score: readDoubleOr(json, 'score', 0),
        subcategoryId: readString(json, 'subcategoryId'),
        iconUrl: readString(json, 'iconUrl'),
      );

  final String categoryId;
  final LocalizedText name;
  final LocalizedText categoryName;
  final JobType jobType;
  final double score;
  final String? subcategoryId;
  final String? iconUrl;
}

/// A service the customer used before (`GET /customers/me/recent-services`).
class RecentService {
  const RecentService({
    required this.jobType,
    required this.lastUsedAt,
    required this.jobCount,
    this.categoryId,
    this.categoryName,
    this.categorySlug,
    this.iconUrl,
  });

  factory RecentService.fromJson(JsonMap json) => RecentService(
        jobType: JobType.fromValue(readString(json, 'jobType')) ?? JobType.homeService,
        lastUsedAt: readDateTimeOr(json, 'lastUsedAt', DateTime.now()),
        jobCount: readIntOr(json, 'jobCount', 0),
        categoryId: readString(json, 'categoryId'),
        categoryName: LocalizedText.maybe(json, 'categoryName'),
        categorySlug: readString(json, 'categorySlug'),
        iconUrl: readString(json, 'iconUrl'),
      );

  final JobType jobType;
  final DateTime lastUsedAt;
  final int jobCount;
  final String? categoryId;
  final LocalizedText? categoryName;
  final String? categorySlug;
  final String? iconUrl;
}

/// Maps `#RRGGBB` from the catalogue into a Flutter colour.
Color? parseHexColor(String? hex) {
  if (hex == null) return null;
  final String value = hex.replaceFirst('#', '');
  if (value.length != 6) return null;
  final int? rgb = int.tryParse(value, radix: 16);
  return rgb == null ? null : Color(0xFF000000 | rgb);
}

/// The token colour for a service, used when the operator set none.
Color serviceColorFor(JobType type) {
  switch (type) {
    case JobType.ride:
      return TamamServiceColors.ride;
    case JobType.delivery:
      return TamamServiceColors.delivery;
    case JobType.homeService:
      return TamamServiceColors.homeService;
    case JobType.food:
    case JobType.grocery:
    case JobType.pharmacy:
    case JobType.shopping:
    case JobType.moving:
    case JobType.roadAssistance:
      return TamamServiceColors.urgent;
  }
}
