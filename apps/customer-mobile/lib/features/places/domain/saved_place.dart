import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';

/// HOME and WORK are singletons server-side; CUSTOM can repeat.
enum SavedPlaceKind {
  home('HOME'),
  work('WORK'),
  custom('CUSTOM');

  const SavedPlaceKind(this.value);

  final String value;

  static SavedPlaceKind fromValue(String? value) {
    for (final SavedPlaceKind kind in SavedPlaceKind.values) {
      if (kind.value == value) return kind;
    }
    return SavedPlaceKind.custom;
  }
}

/// `SavedPlaceDto` — an [Address] the customer named and kept.
class SavedPlace {
  const SavedPlace({
    required this.id,
    required this.kind,
    required this.label,
    required this.address,
    required this.createdAt,
  });

  factory SavedPlace.fromJson(JsonMap json) => SavedPlace(
        id: readStringOr(json, 'id', ''),
        kind: SavedPlaceKind.fromValue(readString(json, 'kind')),
        label: readStringOr(json, 'label', ''),
        address: Address.fromJson(json),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
      );

  final String id;
  final SavedPlaceKind kind;
  final String label;
  final Address address;
  final DateTime createdAt;

  /// The body `upsertSavedPlaceSchema` expects (address fields + kind + label).
  JsonMap toRequestJson() => <String, Object?>{
        ...address.toJson(),
        'kind': kind.value,
        'label': label,
      };
}
