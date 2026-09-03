import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/maps/geocoding_service.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/features/places/data/places_repository.dart';
import 'package:tamam_customer/features/places/domain/saved_place.dart';

final Provider<PlacesRepository> placesRepositoryProvider =
    Provider<PlacesRepository>((Ref ref) => PlacesRepository(ref.watch(apiClientProvider)));

/// The customer's saved places; invalidated after every mutation.
class SavedPlacesController extends AsyncNotifier<List<SavedPlace>> {
  @override
  Future<List<SavedPlace>> build() => ref.watch(placesRepositoryProvider).list();

  Future<SavedPlace> save(SavedPlace place, {String? id}) async {
    final PlacesRepository repository = ref.read(placesRepositoryProvider);
    final SavedPlace saved = id == null ? await repository.create(place) : await repository.update(id, place);
    ref.invalidateSelf();
    return saved;
  }

  Future<void> remove(String id) async {
    await ref.read(placesRepositoryProvider).delete(id);
    ref.invalidateSelf();
  }
}

final AsyncNotifierProvider<SavedPlacesController, List<SavedPlace>> savedPlacesProvider =
    AsyncNotifierProvider<SavedPlacesController, List<SavedPlace>>(SavedPlacesController.new);

/// The address the home header shows and every new job starts from.
///
/// Resolution order: an address the customer picked (persisted) → the device
/// location reverse-geocoded → nothing, in which case the UI asks.
class CurrentAddressController extends Notifier<Address?> {
  @override
  Address? build() {
    final JsonMap? cached = ref.read(prefsStoreProvider).getJson(PrefsStore.keyLastAddress);
    return cached == null ? null : Address.fromJson(cached);
  }

  /// Picks the address up from GPS. Returns `false` when permission or the fix
  /// is unavailable, so the caller can show the right explainer.
  Future<bool> useDeviceLocation({bool reverseGeocode = true}) async {
    final LocationService location = ref.read(locationServiceProvider);
    final GeoPoint? point = await location.current();
    if (point == null) return false;

    if (!reverseGeocode) {
      await select(Address(lat: point.lat, lng: point.lng, formatted: _coordinateLabel(point)));
      return true;
    }
    try {
      final GeocodingService geocoding = ref.read(geocodingServiceProvider);
      final String language = ref.read(localeControllerProvider).languageCode;
      await select(await geocoding.reverse(point, language: language));
    } on Object {
      // A geocoding outage must not block ordering: keep the coordinates.
      await select(Address(lat: point.lat, lng: point.lng, formatted: _coordinateLabel(point)));
    }
    return true;
  }

  Future<void> select(Address address) async {
    state = address;
    await ref.read(prefsStoreProvider).setJson(PrefsStore.keyLastAddress, address.toJson());
  }

  Future<void> clear() async {
    state = null;
    await ref.read(prefsStoreProvider).remove(PrefsStore.keyLastAddress);
  }

  String _coordinateLabel(GeoPoint point) =>
      '${point.lat.toStringAsFixed(5)}, ${point.lng.toStringAsFixed(5)}';
}

final NotifierProvider<CurrentAddressController, Address?> currentAddressProvider =
    NotifierProvider<CurrentAddressController, Address?>(CurrentAddressController.new);

/// The point used to bias catalogue, pricing and banner targeting requests.
final Provider<GeoPoint?> currentPointProvider =
    Provider<GeoPoint?>((Ref ref) => ref.watch(currentAddressProvider)?.point);

/// Current location-permission state, refreshed whenever a screen asks.
final FutureProvider<LocationAvailability> locationAvailabilityProvider =
    FutureProvider<LocationAvailability>((Ref ref) => ref.watch(locationServiceProvider).status());

/// Debounced place search used by the address sheet.
///
/// Auto-disposed per query string: typing a new character disposes the previous
/// provider, and the debounce guard below stops its request from ever firing.
final AutoDisposeFutureProviderFamily<List<PlaceSuggestion>, String> placeSearchProvider =
    FutureProvider.autoDispose.family<List<PlaceSuggestion>, String>((Ref<Object?> ref, String query) async {
  if (query.trim().length < 2) return const <PlaceSuggestion>[];
  bool cancelled = false;
  ref.onDispose(() => cancelled = true);
  // A short debounce keeps Nominatim inside its usage policy while typing.
  await Future<void>.delayed(const Duration(milliseconds: 350));
  if (cancelled) return const <PlaceSuggestion>[];
  return ref.read(geocodingServiceProvider).search(
        query,
        near: ref.read(currentPointProvider),
        language: ref.read(localeControllerProvider).languageCode,
      );
});
