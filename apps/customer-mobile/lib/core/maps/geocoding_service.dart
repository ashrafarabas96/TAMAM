import 'package:dio/dio.dart' hide Headers;
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';

/// One place suggestion shown in the address search sheet.
class PlaceSuggestion {
  const PlaceSuggestion({
    required this.title,
    required this.subtitle,
    required this.lat,
    required this.lng,
    this.placeId,
    this.city,
  });

  final String title;
  final String subtitle;
  final double lat;
  final double lng;
  final String? placeId;
  final String? city;

  Address toAddress() => Address(
        lat: lat,
        lng: lng,
        formatted: subtitle.isEmpty ? title : '$title، $subtitle',
        city: city,
        placeId: placeId,
      );
}

/// Forward/reverse geocoding.
///
/// The TAMAM API deliberately exposes no geocoding endpoints, so the app talks
/// to a Nominatim-compatible service directly. Keeping it behind this interface
/// means swapping in a self-hosted instance (or a commercial provider) is a
/// one-class change.
abstract interface class GeocodingService {
  /// Free-text search, optionally biased towards [near].
  Future<List<PlaceSuggestion>> search(String query, {GeoPoint? near, String language = 'ar'});

  /// Turns a map pin into a printable address.
  Future<Address> reverse(GeoPoint point, {String language = 'ar'});
}

/// Nominatim implementation (OpenStreetMap by default).
class NominatimGeocodingService implements GeocodingService {
  NominatimGeocodingService({required String baseUrl, required String userAgent, Dio? client})
      : _dio = client ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 15),
                headers: <String, Object?>{'User-Agent': userAgent},
              ),
            );

  /// Palestine + the immediate surroundings, so a search for "شارع" does not
  /// return results from another continent.
  static const String _viewbox = '34.10,29.40,35.90,33.40';

  final Dio _dio;

  @override
  Future<List<PlaceSuggestion>> search(String query, {GeoPoint? near, String language = 'ar'}) async {
    final String trimmed = query.trim();
    if (trimmed.length < 2) return const <PlaceSuggestion>[];
    try {
      final Response<Object?> response = await _dio.get<Object?>(
        '/search',
        queryParameters: <String, Object?>{
          'q': trimmed,
          'format': 'jsonv2',
          'addressdetails': 1,
          'limit': 12,
          'accept-language': language,
          'viewbox': _viewbox,
          'bounded': 0,
        },
      );
      return asJsonList(response.data).map(_toSuggestion).toList(growable: false);
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  @override
  Future<Address> reverse(GeoPoint point, {String language = 'ar'}) async {
    try {
      final Response<Object?> response = await _dio.get<Object?>(
        '/reverse',
        queryParameters: <String, Object?>{
          'lat': point.lat,
          'lon': point.lng,
          'format': 'jsonv2',
          'addressdetails': 1,
          'zoom': 18,
          'accept-language': language,
        },
      );
      final JsonMap json = asJsonMap(response.data) ?? const <String, Object?>{};
      final JsonMap address = readDynamicMap(json, 'address');
      final String display = readStringOr(json, 'display_name', '');
      return Address(
        lat: point.lat,
        lng: point.lng,
        formatted: display.isEmpty ? _fallbackLabel(point) : display,
        street: readString(address, 'road'),
        building: readString(address, 'house_number'),
        city: readString(address, 'city') ?? readString(address, 'town') ?? readString(address, 'village'),
        placeId: readString(json, 'osm_id'),
      );
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  PlaceSuggestion _toSuggestion(JsonMap json) {
    final String display = readStringOr(json, 'display_name', '');
    final List<String> parts = display.split(',').map((String p) => p.trim()).toList();
    final JsonMap address = readDynamicMap(json, 'address');
    return PlaceSuggestion(
      title: readString(json, 'name')?.trim().isNotEmpty ?? false
          ? readStringOr(json, 'name', parts.isEmpty ? display : parts.first)
          : (parts.isEmpty ? display : parts.first),
      subtitle: parts.length > 1 ? parts.sublist(1).join('، ') : '',
      lat: double.tryParse(readStringOr(json, 'lat', '')) ?? readDoubleOr(json, 'lat', 0),
      lng: double.tryParse(readStringOr(json, 'lon', '')) ?? readDoubleOr(json, 'lon', 0),
      placeId: readString(json, 'osm_id'),
      city: readString(address, 'city') ?? readString(address, 'town') ?? readString(address, 'village'),
    );
  }

  String _fallbackLabel(GeoPoint point) =>
      '${point.lat.toStringAsFixed(5)}, ${point.lng.toStringAsFixed(5)}';

  AppFailure _failure(DioException error) => error.type == DioExceptionType.connectionError
      ? const AppFailure.offline()
      : AppFailure.network(error.message ?? 'Geocoding failed');
}
