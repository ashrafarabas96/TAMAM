import 'dart:async';
import 'dart:io' show Platform;
import 'dart:ui' show DartPluginRegistrant;

import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The Android foreground service that keeps the process — and therefore the
/// location stream in the main isolate — alive while the partner is ONLINE.
///
/// Design notes (see README → "Background location"):
///  * Android: a foreground service of type `location` is mandatory on API 29+
///    to keep receiving fixes while the app is not on screen. The service
///    isolate does *not* read the GPS itself; it only holds the foreground
///    notification. All samples flow through `WorkSessionController` in the
///    main isolate, so there is a single code path to reason about.
///  * iOS: there is no foreground service. `UIBackgroundModes: location` plus
///    `allowBackgroundLocationUpdates` on the stream (set in
///    `LocationService.watch(background: true)`) keep the app running; the OS
///    shows the blue status-bar indicator. The service is never started there.
///  * The service is started only after `PUT /partners/me/availability` said
///    ONLINE, and stopped as soon as the partner is OFFLINE, signs out, or
///    permission is revoked — a notification that promises "online" while the
///    server thinks otherwise would be a lie.
abstract final class WorkForegroundService {
  static const int notificationId = 1027;
  static const String channelId = 'tamam_partner_work';

  static const String _stopEvent = 'stop';
  static const String _updateEvent = 'update';

  static bool _configured = false;

  /// Configures the plugin once. Safe to call on every launch; it never starts
  /// the service. The initial notification text is loaded straight from the
  /// ARB catalogue for the persisted locale because no widget tree exists yet.
  static Future<void> configure({Locale locale = const Locale('ar')}) async {
    if (_configured || !Platform.isAndroid) return;
    final AppLocalizations l10n = await AppLocalizations.delegate.load(locale);
    await FlutterBackgroundService().configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onServiceStart,
        autoStart: false,
        autoStartOnBoot: false,
        isForegroundMode: true,
        notificationChannelId: channelId,
        initialNotificationTitle: l10n.foregroundNotificationTitle,
        initialNotificationContent: l10n.foregroundNotificationIdle,
        foregroundServiceNotificationId: notificationId,
        foregroundServiceTypes: <AndroidForegroundType>[AndroidForegroundType.location],
      ),
      iosConfiguration: IosConfiguration(autoStart: false),
    );
    _configured = true;
  }

  static Future<bool> isRunning() async {
    if (!Platform.isAndroid) return false;
    return FlutterBackgroundService().isRunning();
  }

  /// Starts the service and sets the notification copy for the current mode.
  static Future<void> start({required String title, required String content}) async {
    if (!Platform.isAndroid) return;
    final FlutterBackgroundService service = FlutterBackgroundService();
    if (!await service.isRunning()) {
      await service.startService();
    }
    // The isolate needs a moment before it listens; the retry is harmless.
    await Future<void>.delayed(const Duration(milliseconds: 400));
    service.invoke(_updateEvent, <String, Object?>{'title': title, 'content': content});
  }

  /// Updates the persistent notification (idle ↔ on a job).
  static Future<void> update({required String title, required String content}) async {
    if (!Platform.isAndroid) return;
    final FlutterBackgroundService service = FlutterBackgroundService();
    if (!await service.isRunning()) return;
    service.invoke(_updateEvent, <String, Object?>{'title': title, 'content': content});
  }

  static Future<void> stop() async {
    if (!Platform.isAndroid) return;
    final FlutterBackgroundService service = FlutterBackgroundService();
    if (await service.isRunning()) service.invoke(_stopEvent);
  }
}

/// Entry point of the service isolate. It keeps the foreground notification up
/// to date and stops itself on request; nothing else runs here.
@pragma('vm:entry-point')
Future<void> onServiceStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  if (service is AndroidServiceInstance) {
    await service.setAsForegroundService();
  }
  service.on('update').listen((Map<String, dynamic>? event) {
    if (service is! AndroidServiceInstance || event == null) return;
    final Object? title = event['title'];
    final Object? content = event['content'];
    if (title is String && content is String) {
      unawaited(service.setForegroundNotificationInfo(title: title, content: content));
    }
  });
  service.on('stop').listen((Map<String, dynamic>? _) {
    unawaited(service.stopSelf());
  });
}
