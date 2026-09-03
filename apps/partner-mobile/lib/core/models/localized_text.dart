import 'package:tamam_partner/core/models/json.dart';

/// `{ ar, en }` pairs returned for every catalog/creative string.
///
/// Resolution is explicit: the app asks for the active locale and falls back to
/// the other language only when the requested one is empty, so a half-filled
/// record never renders as a blank label.
class LocalizedText {
  const LocalizedText({required this.ar, required this.en});

  factory LocalizedText.fromJson(JsonMap json) => LocalizedText(
        ar: readStringOr(json, 'ar', ''),
        en: readStringOr(json, 'en', ''),
      );

  const LocalizedText.single(String value)
      : ar = value,
        en = value;

  final String ar;
  final String en;

  bool get isEmpty => ar.isEmpty && en.isEmpty;

  /// Resolves for a language code (`ar` / `en`), falling back to the other one.
  String resolve(String languageCode) {
    if (languageCode.startsWith('ar')) return ar.isNotEmpty ? ar : en;
    return en.isNotEmpty ? en : ar;
  }

  JsonMap toJson() => <String, Object?>{'ar': ar, 'en': en};

  /// Reads an optional localized field: `null` in JSON stays `null` here.
  static LocalizedText? maybe(JsonMap json, String key) {
    final JsonMap? map = asJsonMap(json[key]);
    if (map == null) return null;
    final LocalizedText text = LocalizedText.fromJson(map);
    return text.isEmpty ? null : text;
  }

  static LocalizedText required(JsonMap json, String key) =>
      maybe(json, key) ?? const LocalizedText(ar: '', en: '');
}
