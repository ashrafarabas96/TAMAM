import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';
import 'package:tamam_partner/core/models/geo.dart';

/// What the app is allowed to do with the device location right now.
enum LocationAvailability {
  /// Foreground ("while in use") permission and the OS service are both on.
  granted,

  /// Background ("always") permission — required for a full work session.
  grantedAlways,

  /// The user said no, but can be asked again.
  denied,

  /// The user said "never ask again" / restricted by policy — settings only.
  deniedForever,

  /// Permission is fine but the device's location service is switched off.
  serviceDisabled,
}

extension LocationAvailabilityX on LocationAvailability {
  /// Enough to work at all (the OS may still throttle when backgrounded).
  bool get isUsable =>
      this == LocationAvailability.granted || this == LocationAvailability.grantedAlways;

  /// Enough to keep reporting while the app is not on screen.
  bool get isBackgroundCapable => this == LocationAvailability.grantedAlways;
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

  /// Requests foreground permission, returning the resulting state (never throws).
  Future<LocationAvailability> request() async {
    if (!await Geolocator.isLocationServiceEnabled()) return LocationAvailability.serviceDisabled;
    final LocationPermission current = await Geolocator.checkPermission();
    if (current == LocationPermission.denied) return _map(await Geolocator.requestPermission());
    return _map(current);
  }

  /// Escalates to background ("always") permission.
  ///
  /// Android 11+ refuses to grant it from a dialog — the second request opens no
  /// prompt at all — so a `denied`/`deniedForever` answer must be handled by
  /// sending the partner to app settings, which the availability sheet does.
  Future<LocationAvailability> requestAlways() async {
    final LocationAvailability foreground = await request();
    if (!foreground.isUsable) return foreground;
    if (foreground == LocationAvailability.grantedAlways) return foreground;
    return _map(await Geolocator.requestPermission());
  }

  /// The current position, or `null` when unavailable for any reason.
  Future<GeoPoint?> current({Duration timeout = const Duration(seconds: 12)}) async {
    if (!(await status()).isUsable) return null;
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

  /// A full sample (accuracy, heading, speed) for the calls that require one:
  /// `arrive`, `start`, `complete` and the availability change to ONLINE.
  Future<LocationSample?> currentSample({Duration timeout = const Duration(seconds: 12)}) async {
    if (!(await status()).isUsable) return null;
    try {
      final Position position = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.best, timeLimit: timeout),
      );
      return sampleFrom(position);
    } on Object {
      final Position? last = await Geolocator.getLastKnownPosition();
      return last == null ? null : sampleFrom(last);
    }
  }

  /// The continuous stream the work session consumes.
  ///
  /// [distanceFilterMeters] is the battery lever: a moving driver produces a
  /// sample every few metres, a parked one produces almost none, and the OS —
  /// not a timer — decides when to wake the app.
  Stream<LocationSample> watch({
    int distanceFilterMeters = 25,
    bool background = false,
  }) =>
      Geolocator.getPositionStream(
        locationSettings: _settings(distanceFilterMeters: distanceFilterMeters, background: background),
      ).map(sampleFrom);

  /// Maps a plugin [Position] onto the `locationSampleSchema` shape.
  ///
  /// `heading` and `speed` are dropped when the platform reports the "unknown"
  /// sentinels, because the API validates their ranges.
  static LocationSample sampleFrom(Position position) => LocationSample(
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy.isFinite && position.accuracy >= 0
            ? position.accuracy.clamp(0, 10000).toDouble()
            : 10000,
        timestamp: position.timestamp.toUtc(),
        heading: position.heading.isFinite && position.heading >= 0 && position.heading <= 360
            ? position.heading
            : null,
        speed: position.speed.isFinite && position.speed >= 0 && position.speed <= 120 ? position.speed : null,
      );

  Future<void> openAppSettings() => Geolocator.openAppSettings();

  Future<void> openLocationSettings() => Geolocator.openLocationSettings();

  /// Platform-specific stream settings.
  ///
  /// Android pairs the stream with the app's own foreground service, so the
  /// plugin's notification is disabled to avoid a second, duplicate one. iOS
  /// needs `allowBackgroundLocationUpdates` plus the `location` background mode
  /// in Info.plist, and shows the blue status bar indicator while it runs.
  LocationSettings _settings({required int distanceFilterMeters, required bool background}) {
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilterMeters,
        forceLocationManager: false,
        intervalDuration: const Duration(seconds: 5),
      );
    }
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilterMeters,
        activityType: ActivityType.automotiveNavigation,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: background,
        allowBackgroundLocationUpdates: background,
      );
    }
    return LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: distanceFilterMeters);
  }

  LocationAvailability _map(LocationPermission permission) {
    switch (permission) {
      case LocationPermission.always:
        return LocationAvailability.grantedAlways;
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
