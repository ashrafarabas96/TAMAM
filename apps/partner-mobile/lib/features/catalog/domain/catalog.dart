import 'package:latlong2/latlong.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/localized_text.dart';

/// A service category the partner can be skilled in (`ServiceCategoryDto`).
///
/// The partner app needs only the identifying fields plus the documents the
/// category demands — pricing and dynamic forms belong to the customer app.
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.jobType,
    required this.slug,
    required this.name,
    required this.requiredPartnerRole,
    required this.requiredDocumentTypes,
    required this.isActive,
    this.description,
    this.iconUrl,
  });

  factory ServiceCategory.fromJson(JsonMap json) => ServiceCategory(
        id: readStringOr(json, 'id', ''),
        jobType: JobType.fromValue(readString(json, 'jobType')) ?? JobType.homeService,
        slug: readStringOr(json, 'slug', ''),
        name: LocalizedText.required(json, 'name'),
        requiredPartnerRole:
            PartnerRoleType.fromValue(readString(json, 'requiredPartnerRole')) ?? PartnerRoleType.technician,
        requiredDocumentTypes: readStringList(json, 'requiredDocumentTypes')
            .map(DocumentType.fromValue)
            .whereType<DocumentType>()
            .toList(growable: false),
        isActive: readBoolOr(json, 'isActive', true),
        description: LocalizedText.maybe(json, 'description'),
        iconUrl: readString(json, 'iconUrl'),
      );

  final String id;
  final JobType jobType;
  final String slug;
  final LocalizedText name;
  final PartnerRoleType requiredPartnerRole;
  final List<DocumentType> requiredDocumentTypes;
  final bool isActive;
  final LocalizedText? description;
  final String? iconUrl;
}

/// A service zone with its polygon (`ServiceZoneDto`).
class ServiceZone {
  const ServiceZone({
    required this.id,
    required this.code,
    required this.name,
    required this.city,
    required this.currency,
    required this.center,
    required this.polygon,
    required this.isActive,
  });

  factory ServiceZone.fromJson(JsonMap json) => ServiceZone(
        id: readStringOr(json, 'id', ''),
        code: readStringOr(json, 'code', ''),
        name: LocalizedText.required(json, 'name'),
        city: readStringOr(json, 'city', ''),
        currency: readStringOr(json, 'currency', 'ILS'),
        center: readObject<GeoPoint>(json, 'center', GeoPoint.fromJson) ?? const GeoPoint(lat: 0, lng: 0),
        polygon: _readPolygon(json['polygon']),
        isActive: readBoolOr(json, 'isActive', true),
      );

  final String id;
  final String code;
  final LocalizedText name;
  final String city;
  final String currency;
  final GeoPoint center;

  /// The outer ring, already converted from GeoJSON `[lng, lat]` order.
  final List<LatLng> polygon;
  final bool isActive;

  /// GeoJSON stores `[lng, lat]`; `latlong2` wants `(lat, lng)`. Any malformed
  /// ring degrades to an empty polygon so the map still renders.
  static List<LatLng> _readPolygon(Object? raw) {
    final JsonMap? polygon = asJsonMap(raw);
    final Object? coordinates = polygon?['coordinates'];
    if (coordinates is! List || coordinates.isEmpty) return const <LatLng>[];
    final Object? ring = coordinates.first;
    if (ring is! List) return const <LatLng>[];
    final List<LatLng> points = <LatLng>[];
    for (final Object? pair in ring) {
      if (pair is! List || pair.length < 2) continue;
      final Object? lng = pair[0];
      final Object? lat = pair[1];
      if (lng is num && lat is num) points.add(LatLng(lat.toDouble(), lng.toDouble()));
    }
    return points;
  }
}
