/// Small, defensive JSON readers shared by every model.
///
/// The API is the source of truth, but a mobile client must never crash on an
/// unexpected null or a number that arrives as `int` where `double` was
/// expected. Every reader here is total: it either returns a usable value or
/// the documented fallback.
library;

typedef JsonMap = Map<String, Object?>;

/// Casts an arbitrary decoded JSON value to a [JsonMap], or returns `null`.
JsonMap? asJsonMap(Object? value) {
  if (value is JsonMap) return value;
  if (value is Map) return value.map((Object? k, Object? v) => MapEntry<String, Object?>(k.toString(), v));
  return null;
}

/// Casts an arbitrary decoded JSON value to a list of [JsonMap].
List<JsonMap> asJsonList(Object? value) {
  if (value is! List) return const <JsonMap>[];
  final List<JsonMap> out = <JsonMap>[];
  for (final Object? item in value) {
    final JsonMap? map = asJsonMap(item);
    if (map != null) out.add(map);
  }
  return out;
}

/// Reads a nullable string, treating empty strings as present (the API trims).
String? readString(JsonMap json, String key) {
  final Object? value = json[key];
  return value is String ? value : null;
}

String readStringOr(JsonMap json, String key, String fallback) => readString(json, key) ?? fallback;

int? readInt(JsonMap json, String key) {
  final Object? value = json[key];
  if (value is int) return value;
  if (value is double) return value.round();
  if (value is String) return int.tryParse(value);
  return null;
}

int readIntOr(JsonMap json, String key, int fallback) => readInt(json, key) ?? fallback;

double? readDouble(JsonMap json, String key) {
  final Object? value = json[key];
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

double readDoubleOr(JsonMap json, String key, double fallback) => readDouble(json, key) ?? fallback;

bool readBoolOr(JsonMap json, String key, bool fallback) {
  final Object? value = json[key];
  if (value is bool) return value;
  if (value is String) {
    if (value == 'true') return true;
    if (value == 'false') return false;
  }
  return fallback;
}

/// Parses an ISO-8601 timestamp to local time; returns `null` when absent or malformed.
DateTime? readDateTime(JsonMap json, String key) {
  final String? raw = readString(json, key);
  if (raw == null) return null;
  return DateTime.tryParse(raw)?.toLocal();
}

DateTime readDateTimeOr(JsonMap json, String key, DateTime fallback) => readDateTime(json, key) ?? fallback;

List<String> readStringList(JsonMap json, String key) {
  final Object? value = json[key];
  if (value is! List) return const <String>[];
  return value.whereType<String>().toList(growable: false);
}

/// Reads a nested object and maps it, tolerating `null` and wrong shapes.
T? readObject<T>(JsonMap json, String key, T Function(JsonMap json) fromJson) {
  final JsonMap? map = asJsonMap(json[key]);
  return map == null ? null : fromJson(map);
}

/// Reads a list of nested objects; missing or malformed lists become empty.
List<T> readList<T>(JsonMap json, String key, T Function(JsonMap json) fromJson) =>
    asJsonList(json[key]).map(fromJson).toList(growable: false);

/// Reads a free-form map (dynamic fields, notification payloads).
JsonMap readDynamicMap(JsonMap json, String key) => asJsonMap(json[key]) ?? const <String, Object?>{};

/// Formats a [DateTime] the way every request body expects it (UTC ISO-8601).
String toIsoUtc(DateTime value) => value.toUtc().toIso8601String();
