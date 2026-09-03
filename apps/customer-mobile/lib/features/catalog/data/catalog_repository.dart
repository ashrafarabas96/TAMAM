import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';

/// Read-only access to the service catalogue.
class CatalogRepository {
  const CatalogRepository(this._api);

  final ApiClient _api;

  Future<List<ServiceType>> serviceTypes({String? zoneId}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.serviceTypes,
      query: <String, Object?>{'zoneId': zoneId},
    );
    return raw.map(ServiceType.fromJson).toList(growable: false)
      ..sort((ServiceType a, ServiceType b) => a.sortOrder.compareTo(b.sortOrder));
  }

  Future<List<ServiceCategory>> categories({JobType? jobType, String? zoneId}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.categories,
      query: <String, Object?>{'jobType': jobType?.value, 'zoneId': zoneId},
    );
    return raw.map(ServiceCategory.fromJson).toList(growable: false)
      ..sort((ServiceCategory a, ServiceCategory b) => a.sortOrder.compareTo(b.sortOrder));
  }

  /// Full detail including subcategories, options and dynamic fields.
  Future<ServiceCategory> category(String id) async =>
      ServiceCategory.fromJson(await _api.getObject(ApiPaths.category(id)));

  Future<List<VehicleType>> vehicleTypes({JobType? jobType}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.vehicleTypes,
      query: <String, Object?>{'jobType': jobType?.value},
    );
    return raw.map(VehicleType.fromJson).toList(growable: false);
  }

  Future<List<PackageCategory>> packageCategories() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.packageCategories);
    return raw
        .map(PackageCategory.fromJson)
        .where((PackageCategory p) => !p.isProhibited)
        .toList(growable: false);
  }

  Future<List<CatalogSearchHit>> search(String query, {GeoPoint? near, String? zoneId, int limit = 12}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.catalogSearch,
      query: <String, Object?>{
        'q': query,
        'limit': limit,
        if (zoneId != null) 'zoneId': zoneId,
        if (near != null) 'lat': near.lat,
        if (near != null) 'lng': near.lng,
      },
    );
    return raw.map(CatalogSearchHit.fromJson).toList(growable: false);
  }

  Future<List<RecentService>> recentServices() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.recentServices);
    return raw.map(RecentService.fromJson).toList(growable: false);
  }

  Future<List<ServiceCategory>> favorites() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.favorites);
    return raw.map(ServiceCategory.fromJson).toList(growable: false);
  }

  Future<void> addFavorite(String categoryId) async {
    await _api.postObject(ApiPaths.favorites, body: <String, Object?>{'categoryId': categoryId});
  }

  Future<void> removeFavorite(String categoryId) => _api.delete(ApiPaths.favorite(categoryId));

  /// `GET /zones/resolve` → whether the point is covered and which zone it is.
  Future<ZoneResolution> resolveZone(GeoPoint point) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.resolveZone,
      query: <String, Object?>{'lat': point.lat, 'lng': point.lng},
    );
    final JsonMap? zone = asJsonMap(json['zone']);
    return ZoneResolution(
      inServiceArea: readBoolOr(json, 'inServiceArea', false),
      zoneId: zone == null ? null : readString(zone, 'id'),
      zoneName: zone == null ? null : LocalizedText.maybe(zone, 'name'),
      currency: zone == null ? null : readString(zone, 'currency'),
    );
  }
}

/// The answer to "do we operate here?".
class ZoneResolution {
  const ZoneResolution({
    required this.inServiceArea,
    this.zoneId,
    this.zoneName,
    this.currency,
  });

  const ZoneResolution.unknown()
      : inServiceArea = true,
        zoneId = null,
        zoneName = null,
        currency = null;

  final bool inServiceArea;
  final String? zoneId;
  final LocalizedText? zoneName;
  final String? currency;
}
