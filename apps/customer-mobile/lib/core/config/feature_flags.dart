import 'package:tamam_customer/core/models/json.dart';

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
  static const String cardPayments = 'card_payments';
  static const String walletPayments = 'wallet_payments';
  static const String tripPin = 'trip_pin';
  static const String urgentServices = 'urgent_services';
  static const String scheduledJobs = 'scheduled_jobs';
  static const String shareTrip = 'share_trip';
  static const String sos = 'sos';
  static const String referrals = 'referrals';
  static const String promoBanners = 'promo_banners';
  static const String chat = 'chat';
  static const String multiStop = 'multi_stop';

  static const Map<String, bool> _fallbacks = <String, bool>{
    cardPayments: false,
    walletPayments: true,
    tripPin: true,
    urgentServices: true,
    scheduledJobs: true,
    shareTrip: true,
    sos: true,
    referrals: true,
    promoBanners: true,
    chat: true,
    multiStop: false,
  };

  final Map<String, bool> _values;

  bool isEnabled(String key) => _values[key] ?? _fallbacks[key] ?? false;

  bool get hasCardPayments => isEnabled(cardPayments);
  bool get hasWalletPayments => isEnabled(walletPayments);
  bool get hasScheduledJobs => isEnabled(scheduledJobs);
  bool get hasUrgentServices => isEnabled(urgentServices);
  bool get hasShareTrip => isEnabled(shareTrip);
  bool get hasSos => isEnabled(sos);
  bool get hasReferrals => isEnabled(referrals);
  bool get hasPromoBanners => isEnabled(promoBanners);
  bool get hasChat => isEnabled(chat);

  JsonMap toJson() => Map<String, Object?>.from(_values);
}
