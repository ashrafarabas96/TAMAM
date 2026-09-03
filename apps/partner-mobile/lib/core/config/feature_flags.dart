import 'package:tamam_partner/core/models/json.dart';

/// Server-controlled feature switches (`GET /config/feature-flags`).
///
/// The response is a flat `Record<string, boolean>`. Defaults here match the
/// platform defaults so a cold start without network still renders a sensible
/// app rather than hiding everything.
class FeatureFlags {
  const FeatureFlags(this._values);

  const FeatureFlags.defaults() : _values = const <String, bool>{};

  factory FeatureFlags.fromJson(JsonMap json) {
    final Map<String, bool> values = <String, bool>{};
    json.forEach((String key, Object? value) {
      if (value is bool) values[key] = value;
    });
    return FeatureFlags(values);
  }

  // Keys mirror `FEATURE_FLAGS` in packages/shared-types.
  static const String tripPin = 'trip_pin';
  static const String promoBanners = 'promo_banners';
  static const String chat = 'chat';
  static const String sos = 'sos';
  static const String scheduledJobs = 'scheduled_jobs';

  static const Map<String, bool> _fallbacks = <String, bool>{
    tripPin: true,
    promoBanners: true,
    chat: true,
    sos: true,
    scheduledJobs: true,
  };

  final Map<String, bool> _values;

  bool isEnabled(String key) => _values[key] ?? _fallbacks[key] ?? false;

  bool get hasTripPin => isEnabled(tripPin);
  bool get hasPromoBanners => isEnabled(promoBanners);
  bool get hasChat => isEnabled(chat);
  bool get hasSos => isEnabled(sos);

  JsonMap toJson() => Map<String, Object?>.from(_values);
}
