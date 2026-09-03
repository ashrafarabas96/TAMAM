import 'package:tamam_customer/core/routing/routes.dart';

/// Translates external links into in-app locations.
///
/// Two shapes are supported:
///  * `tamam://<host>/<rest>` — banner deep links, push payloads, referrals;
///  * `https://tamam.app/<path>` — universal/app links, share-trip URLs.
///
/// Unknown links resolve to `null` so the caller can fall back to opening them
/// in a browser instead of silently swallowing the tap.
abstract final class DeepLinks {
  static const String scheme = 'tamam';
  static const String host = 'tamam.app';

  static String? resolve(Uri uri) {
    if (uri.scheme == scheme) return _fromSegments(<String>[uri.host, ...uri.pathSegments], uri);
    if ((uri.scheme == 'https' || uri.scheme == 'http') && uri.host.endsWith(host)) {
      return _fromSegments(uri.pathSegments, uri);
    }
    return null;
  }

  /// `true` when the link belongs to TAMAM and should be handled in-app.
  static bool isInternal(Uri uri) => resolve(uri) != null;

  static String? _fromSegments(List<String> raw, Uri uri) {
    final List<String> segments = raw.where((String s) => s.isNotEmpty).toList(growable: false);
    if (segments.isEmpty) return Routes.home;

    switch (segments.first) {
      case 'home':
        return Routes.home;
      case 'search':
        return Routes.search;
      case 'orders':
      case 'jobs':
        if (segments.length >= 2) {
          if (segments.length >= 3 && segments[2] == 'chat') return Routes.jobChat(segments[1]);
          if (segments.length >= 3 && segments[2] == 'rating') return Routes.jobRating(segments[1]);
          return Routes.job(segments[1]);
        }
        return Routes.orders;
      case 'category':
        return segments.length >= 2 ? Routes.category(segments[1]) : Routes.home;
      case 'service':
        return segments.length >= 2 ? Routes.service(segments[1]) : Routes.home;
      case 'ride':
        return Routes.ride;
      case 'delivery':
        return Routes.delivery;
      case 'wallet':
        return Routes.wallet;
      case 'promos':
      case 'offers':
        return Routes.promos;
      case 'invite':
      case 'referrals':
        return Routes.referrals;
      case 'notifications':
        return Routes.notifications;
      case 'support':
        return segments.length >= 2 ? Routes.supportTicket(segments[1]) : Routes.support;
      case 'account':
      case 'profile':
        return Routes.account;
      case 't':
        return segments.length >= 2 ? Routes.publicTrack(segments[1]) : null;
      default:
        // A path that already matches an app route is passed through verbatim.
        return uri.path.startsWith('/') && uri.path.length > 1 ? uri.path : null;
    }
  }

  /// The referral code carried by `tamam://invite/<code>`, if any.
  static String? referralCode(Uri uri) {
    if (uri.scheme != scheme || uri.host != 'invite') return null;
    final List<String> segments = uri.pathSegments.where((String s) => s.isNotEmpty).toList();
    return segments.isEmpty ? null : segments.first;
  }
}
