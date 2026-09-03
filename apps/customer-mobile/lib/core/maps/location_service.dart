import 'package:geolocator/geolocator.dart';
import 'package:tamam_customer/core/models/geo.dart';

/// What the app is allowed to do with the device location right now.
enum LocationAvailability {
  /// Permission granted and the OS location service is on.
  granted,

  /// The user said no, but can be asked again.
  denied,

  /// The user said "never ask again" / restricted by policy — settings only.
  deniedForever,

  /// Permission is fine but the device's location service is switched off.
  serviceDisabled,
}

/// Thin wrapper over `geolocator` so screens never touch the plugin directly
/// and every denial has an explicit, testable state.
class LocationService {
  const LocationService();

  /// Ramallah city centre — the map has to open somewhere before a fix arrives.
  static const GeoPoint fallbackCenter = GeoPoint(lat: 31.9038, lng: 35.2034);

  Future<LocationAvailability> status() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationAvailability.serviceDisabled;
    return _map(await Geolocator.checkPermission());
  }

  /// Requests permission, returning the resulting state (never throws).
  Future<LocationAvailability> request() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationAvailability.serviceDisabled;
    final LocationPermission current = await Geolocator.checkPermission();
    if (current == LocationPermission.denied) return _map(await Geolocator.requestPermission());
    return _map(current);
  }

  /// The current position, or `null` when unavailable for any reason.
  ///
  /// Callers fall back to the last known address or [fallbackCenter]; losing a
  /// fix must never block a flow.
  Future<GeoPoint?> current({Duration timeout = const Duration(seconds: 12)}) async {
    if (await status() != LocationAvailability.granted) return null;
    try {
      final Position position = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
      );
      return GeoPoint(lat: position.latitude, lng: position.longitude);
    } on Object {
      final Position? last = await Geolocator.getLastKnownPosition();
      return last == null ? null : GeoPoint(lat: last.latitude, lng: last.longitude);
    }
  }

  Future<void> openAppSettings() => Geolocator.openAppSettings();

  Future<void> openLocationSettings() => Geolocator.openLocationSettings();

  LocationAvailability _map(LocationPermission permission) {
    switch (permission) {
      case LocationPermission.always:
      case LocationPermission.whileInUse:
        return LocationAvailability.granted;
      case LocationPermission.deniedForever:
        return LocationAvailability.deniedForever;
      case LocationPermission.denied:
      case LocationPermission.unableToDetermine:
        return LocationAvailability.denied;
    }
  }
}
