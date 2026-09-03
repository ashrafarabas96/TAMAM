import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/localized_text.dart';

/// A vehicle class the operator offers (`VehicleTypeDto`).
class VehicleType {
  const VehicleType({
    required this.id,
    required this.code,
    required this.name,
    required this.seats,
    required this.allowedJobTypes,
    required this.sortOrder,
    required this.isActive,
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
        isActive: readBoolOr(json, 'isActive', true),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
        cargoCapacityKg: readDouble(json, 'cargoCapacityKg'),
      );

  final String id;

  /// ECONOMY, FAMILY, PREMIUM, MOTORBIKE, DELIVERY_CAR.
  final String code;
  final LocalizedText name;
  final int seats;
  final List<JobType> allowedJobTypes;
  final int sortOrder;
  final bool isActive;
  final LocalizedText? description;
  final String? iconUrl;
  final double? cargoCapacityKg;
}

/// A vehicle the partner registered (`VehicleDto`).
class Vehicle {
  const Vehicle({
    required this.id,
    required this.partnerId,
    required this.vehicleTypeId,
    required this.brand,
    required this.model,
    required this.year,
    required this.color,
    required this.plate,
    required this.seats,
    required this.photoUrls,
    required this.isActive,
    required this.verificationStatus,
    this.vehicleType,
  });

  factory Vehicle.fromJson(JsonMap json) => Vehicle(
        id: readStringOr(json, 'id', ''),
        partnerId: readStringOr(json, 'partnerId', ''),
        vehicleTypeId: readStringOr(json, 'vehicleTypeId', ''),
        brand: readStringOr(json, 'brand', ''),
        model: readStringOr(json, 'model', ''),
        year: readIntOr(json, 'year', 0),
        color: readStringOr(json, 'color', ''),
        plate: readStringOr(json, 'plate', ''),
        seats: readIntOr(json, 'seats', 4),
        photoUrls: readStringList(json, 'photoUrls'),
        isActive: readBoolOr(json, 'isActive', false),
        verificationStatus:
            VerificationStatus.fromValue(readString(json, 'verificationStatus')) ?? VerificationStatus.pending,
        vehicleType: readObject<VehicleType>(json, 'vehicleType', VehicleType.fromJson),
      );

  final String id;
  final String partnerId;
  final String vehicleTypeId;
  final String brand;
  final String model;
  final int year;
  final String color;
  final String plate;
  final int seats;
  final List<String> photoUrls;

  /// The vehicle the partner currently works with.
  final bool isActive;
  final VerificationStatus verificationStatus;
  final VehicleType? vehicleType;

  String get title => '$brand $model'.trim();

  bool get isApproved => verificationStatus == VerificationStatus.approved;

  bool get isRejected => verificationStatus == VerificationStatus.rejected;

  /// Only an approved vehicle may be made active for a shift.
  bool get canActivate => isApproved && !isActive;
}
