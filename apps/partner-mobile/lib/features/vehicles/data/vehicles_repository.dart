import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';

/// The body of `POST /partners/me/vehicles` (`partnerVehicleSchema`).
class VehicleInput {
  const VehicleInput({
    required this.vehicleTypeId,
    required this.brand,
    required this.model,
    required this.year,
    required this.color,
    required this.plate,
    required this.seats,
    required this.photoMediaIds,
  });

  final String vehicleTypeId;
  final String brand;
  final String model;
  final int year;
  final String color;
  final String plate;
  final int seats;
  final List<String> photoMediaIds;

  JsonMap toJson() => <String, Object?>{
        'vehicleTypeId': vehicleTypeId,
        'brand': brand.trim(),
        'model': model.trim(),
        'year': year,
        'color': color.trim(),
        'plate': plate.trim(),
        'seats': seats,
        'photoMediaIds': photoMediaIds,
      };
}

/// `/partners/me/vehicles/**`.
class VehiclesRepository {
  const VehiclesRepository(this._api);

  final ApiClient _api;

  Future<List<Vehicle>> list() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.vehicles);
    return raw.map(Vehicle.fromJson).toList(growable: false);
  }

  Future<Vehicle> get(String id) async => Vehicle.fromJson(await _api.getObject(ApiPaths.vehicle(id)));

  Future<Vehicle> create(VehicleInput input) async =>
      Vehicle.fromJson(await _api.postObject(ApiPaths.vehicles, body: input.toJson()));

  Future<Vehicle> update(String id, VehicleInput input) async =>
      Vehicle.fromJson(await _api.putObject(ApiPaths.vehicle(id), body: input.toJson()));

  Future<Vehicle> activate(String id) async => Vehicle.fromJson(await _api.postObject(ApiPaths.vehicleActivate(id)));

  Future<List<PartnerDocument>> documents(String id) async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.vehicleDocuments(id));
    return raw.map(PartnerDocument.fromJson).toList(growable: false);
  }

  Future<PartnerDocument> addDocument(
    String id, {
    required DocumentType type,
    required String mediaId,
    String? number,
    String? issuedAt,
    String? expiresAt,
  }) async =>
      PartnerDocument.fromJson(
        await _api.postObject(
          ApiPaths.vehicleDocuments(id),
          body: <String, Object?>{
            'type': type.value,
            'mediaId': mediaId,
            if (number != null && number.isNotEmpty) 'number': number,
            if (issuedAt != null) 'issuedAt': issuedAt,
            if (expiresAt != null) 'expiresAt': expiresAt,
          },
        ),
      );
}
