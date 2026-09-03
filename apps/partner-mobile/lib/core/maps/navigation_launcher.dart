import 'package:tamam_partner/core/models/geo.dart';
import 'package:url_launcher/url_launcher.dart';

/// The turn-by-turn apps a partner can hand a destination to.
enum NavigationApp { googleMaps, waze }

/// Opens an external navigation app at a coordinate.
///
/// TAMAM deliberately does not ship its own turn-by-turn engine: partners
/// already trust (and have offline maps in) Google Maps or Waze, and a second
/// navigation voice in the car is a safety problem, not a feature.
abstract final class NavigationLauncher {
  /// Returns `false` when no app could handle the request, so the caller can
  /// show a message instead of failing silently.
  static Future<bool> open(GeoPoint point, {NavigationApp app = NavigationApp.googleMaps}) async {
    for (final Uri candidate in _candidates(point, app)) {
      if (await launchUrl(candidate, mode: LaunchMode.externalApplication)) return true;
    }
    return false;
  }

  /// App scheme first, then the universal web URL as the fallback.
  static List<Uri> _candidates(GeoPoint point, NavigationApp app) {
    final String lat = point.lat.toStringAsFixed(6);
    final String lng = point.lng.toStringAsFixed(6);
    switch (app) {
      case NavigationApp.waze:
        return <Uri>[
          Uri.parse('waze://?ll=$lat,$lng&navigate=yes'),
          Uri.parse('https://waze.com/ul?ll=$lat,$lng&navigate=yes'),
        ];
      case NavigationApp.googleMaps:
        return <Uri>[
          Uri.parse('google.navigation:q=$lat,$lng&mode=d'),
          Uri.parse('comgooglemaps://?daddr=$lat,$lng&directionsmode=driving'),
          Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving'),
        ];
    }
  }
}
