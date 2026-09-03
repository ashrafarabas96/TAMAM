import 'package:tamam_partner/core/routing/routes.dart';

/// Translates external links into in-app locations.
///
/// Two shapes are supported:
///  * `tamam-partner://<host>/<rest>` — push payloads and banner deep links;
///  * `https://partner.tamam.app/<path>` — universal/app links.
///
/// Unknown links resolve to `null` so the caller can fall back to opening them
/// in a browser instead of silently swallowing the tap.
abstract final class DeepLinks {
  static const String scheme = 'tamam-partner';
  static const String host = 'partner.tamam.app';

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
      // A push for a new offer only has to bring the partner to the home
      // screen; the offer sheet itself is driven by the pending-offers query.
      case 'offers':
        return Routes.home;
      case 'work':
        return segments.length >= 2 ? Routes.activeJob(segments[1]) : Routes.home;
      case 'jobs':
        if (segments.length >= 2) {
          if (segments.length >= 3 && segments[2] == 'chat') return Routes.jobChat(segments[1]);
          if (segments.length >= 3 && segments[2] == 'rating') return Routes.rateCustomer(segments[1]);
          return Routes.job(segments[1]);
        }
        return Routes.jobs;
      case 'earnings':
      case 'wallet':
        return Routes.earnings;
      case 'documents':
        return Routes.documents;
      case 'vehicles':
        return segments.length >= 2 ? Routes.vehicle(segments[1]) : Routes.vehicles;
      case 'onboarding':
        return Routes.onboarding;
      case 'notifications':
        return Routes.notifications;
      case 'support':
        return segments.length >= 2 ? Routes.supportTicket(segments[1]) : Routes.support;
      case 'account':
      case 'profile':
        return Routes.account;
      default:
        // A path that already matches an app route is passed through verbatim.
        return uri.path.startsWith('/') && uri.path.length > 1 ? uri.path : null;
    }
  }
}
