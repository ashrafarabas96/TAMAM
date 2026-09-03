import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/models/geo.dart';

/// The partner's last known position, fed by the work session (and by the
/// one-off fixes the availability sheet requests). Used for banner targeting
/// and as the map's opening centre before a fresh fix arrives.
final StateProvider<GeoPoint?> lastKnownPointProvider = StateProvider<GeoPoint?>((Ref ref) => null);
