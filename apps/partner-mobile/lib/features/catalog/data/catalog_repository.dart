import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';

/// Read-only reference data the wizard and the work-preferences screen need.
class CatalogRepository {
  const CatalogRepository(this._api);

  final ApiClient _api;

  /// `GET /catalog/categories?jobType=HOME_SERVICE` — the skills a technician
  /// or service provider can register for.
  Future<List<ServiceCategory>> categories({JobType jobType = JobType.homeService}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.categories,
      query: <String, Object?>{'jobType': jobType.value},
    );
    return raw.map(ServiceCategory.fromJson).where((ServiceCategory c) => c.isActive).toList(growable: false);
  }

  /// `GET /catalog/vehicle-types`.
  Future<List<VehicleType>> vehicleTypes() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.vehicleTypes);
    final List<VehicleType> types =
        raw.map(VehicleType.fromJson).where((VehicleType t) => t.isActive).toList()
          ..sort((VehicleType a, VehicleType b) => a.sortOrder.compareTo(b.sortOrder));
    return types;
  }

  /// `GET /zones` — active service zones with their polygons.
  Future<List<ServiceZone>> zones() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.zones);
    return raw.map(ServiceZone.fromJson).where((ServiceZone z) => z.isActive).toList(growable: false);
  }
}
