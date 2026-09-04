import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';

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
        kind: SavedPlaceKind.fromValue(readString(json, 'kind')) ?? SavedPlaceKind.custom,
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
