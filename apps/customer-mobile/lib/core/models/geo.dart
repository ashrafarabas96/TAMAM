import 'package:latlong2/latlong.dart';
import 'package:tamam_customer/core/models/json.dart';

/// A bare coordinate pair as the API models it.
class GeoPoint {
  const GeoPoint({required this.lat, required this.lng});

  factory GeoPoint.fromJson(JsonMap json) => GeoPoint(
        lat: readDoubleOr(json, 'lat', 0),
        lng: readDoubleOr(json, 'lng', 0),
      );

  factory GeoPoint.fromLatLng(LatLng value) => GeoPoint(lat: value.latitude, lng: value.longitude);

  final double lat;
  final double lng;

  LatLng toLatLng() => LatLng(lat, lng);

  JsonMap toJson() => <String, Object?>{'lat': lat, 'lng': lng};

  @override
  bool operator ==(Object other) => other is GeoPoint && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);
}

/// A location plus the postal detail the API accepts on every job body.
class Address {
  const Address({
    required this.lat,
    required this.lng,
    required this.formatted,
    this.label,
    this.street,
    this.building,
    this.floor,
    this.apartment,
    this.city,
    this.notes,
    this.placeId,
  });

  factory Address.fromJson(JsonMap json) => Address(
        lat: readDoubleOr(json, 'lat', 0),
        lng: readDoubleOr(json, 'lng', 0),
        formatted: readStringOr(json, 'formatted', ''),
        label: readString(json, 'label'),
        street: readString(json, 'street'),
        building: readString(json, 'building'),
        floor: readString(json, 'floor'),
        apartment: readString(json, 'apartment'),
        city: readString(json, 'city'),
        notes: readString(json, 'notes'),
        placeId: readString(json, 'placeId'),
      );

  final double lat;
  final double lng;

  /// Human-readable single line; required by `addressSchema`.
  final String formatted;
  final String? label;
  final String? street;
  final String? building;
  final String? floor;
  final String? apartment;
  final String? city;
  final String? notes;
  final String? placeId;

  GeoPoint get point => GeoPoint(lat: lat, lng: lng);
  LatLng toLatLng() => LatLng(lat, lng);

  /// The secondary line shown under [formatted] on address rows.
  String? get detailLine {
    final List<String> parts = <String>[
      if (building != null && building!.isNotEmpty) building!,
      if (floor != null && floor!.isNotEmpty) floor!,
      if (apartment != null && apartment!.isNotEmpty) apartment!,
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  Address copyWith({
    double? lat,
    double? lng,
    String? formatted,
    String? label,
    String? street,
    String? building,
    String? floor,
    String? apartment,
    String? city,
    String? notes,
    String? placeId,
  }) =>
      Address(
        lat: lat ?? this.lat,
        lng: lng ?? this.lng,
        formatted: formatted ?? this.formatted,
        label: label ?? this.label,
        street: street ?? this.street,
        building: building ?? this.building,
        floor: floor ?? this.floor,
        apartment: apartment ?? this.apartment,
        city: city ?? this.city,
        notes: notes ?? this.notes,
        placeId: placeId ?? this.placeId,
      );

  /// Only non-null keys are emitted: the zod schemas reject `null` for optionals.
  JsonMap toJson() => <String, Object?>{
        'lat': lat,
        'lng': lng,
        'formatted': formatted,
        if (label != null && label!.isNotEmpty) 'label': label,
        if (street != null && street!.isNotEmpty) 'street': street,
        if (building != null && building!.isNotEmpty) 'building': building,
        if (floor != null && floor!.isNotEmpty) 'floor': floor,
        if (apartment != null && apartment!.isNotEmpty) 'apartment': apartment,
        if (city != null && city!.isNotEmpty) 'city': city,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        if (placeId != null && placeId!.isNotEmpty) 'placeId': placeId,
      };
}

/// A GPS sample as `locationSampleSchema` defines it.
class LocationSample {
  const LocationSample({
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.timestamp,
    this.heading,
    this.speed,
  });

  factory LocationSample.fromJson(JsonMap json) => LocationSample(
        lat: readDoubleOr(json, 'lat', 0),
        lng: readDoubleOr(json, 'lng', 0),
        accuracy: readDoubleOr(json, 'accuracy', 0),
        timestamp: readDateTimeOr(json, 'timestamp', DateTime.now()),
        heading: readDouble(json, 'heading'),
        speed: readDouble(json, 'speed'),
      );

  final double lat;
  final double lng;
  final double accuracy;
  final DateTime timestamp;
  final double? heading;
  final double? speed;

  LatLng toLatLng() => LatLng(lat, lng);

  JsonMap toJson() => <String, Object?>{
        'lat': lat,
        'lng': lng,
        'accuracy': accuracy,
        'timestamp': toIsoUtc(timestamp),
        if (heading != null) 'heading': heading,
        if (speed != null) 'speed': speed,
      };
}
