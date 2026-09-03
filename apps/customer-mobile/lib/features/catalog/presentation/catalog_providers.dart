import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/catalog/data/catalog_repository.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';

final Provider<CatalogRepository> catalogRepositoryProvider =
    Provider<CatalogRepository>((Ref ref) => CatalogRepository(ref.watch(apiClientProvider)));

/// The zone the customer's current address falls into.
///
/// Everything price- and availability-related is scoped by it, so it is watched
/// rather than passed around.
final FutureProvider<ZoneResolution> currentZoneProvider = FutureProvider<ZoneResolution>((Ref ref) async {
  final GeoPoint? point = ref.watch(currentPointProvider);
  if (point == null) return const ZoneResolution.unknown();
  return ref.watch(catalogRepositoryProvider).resolveZone(point);
});

/// The zone id, or `null` while unknown — safe to pass straight into queries.
final Provider<String?> currentZoneIdProvider = Provider<String?>(
  (Ref ref) => ref.watch(currentZoneProvider).maybeWhen(
        data: (ZoneResolution zone) => zone.zoneId,
        orElse: () => null,
      ),
);

final FutureProvider<List<ServiceType>> serviceTypesProvider = FutureProvider<List<ServiceType>>(
  (Ref ref) => ref.watch(catalogRepositoryProvider).serviceTypes(zoneId: ref.watch(currentZoneIdProvider)),
);

/// Categories for one job type; the family argument keys the cache.
final FutureProviderFamily<List<ServiceCategory>, JobType> categoriesProvider =
    FutureProvider.family<List<ServiceCategory>, JobType>(
  (Ref ref, JobType jobType) => ref.watch(catalogRepositoryProvider).categories(
        jobType: jobType,
        zoneId: ref.watch(currentZoneIdProvider),
      ),
);

final FutureProviderFamily<ServiceCategory, String> categoryProvider =
    FutureProvider.family<ServiceCategory, String>(
  (Ref ref, String id) => ref.watch(catalogRepositoryProvider).category(id),
);

final FutureProviderFamily<List<VehicleType>, JobType> vehicleTypesProvider =
    FutureProvider.family<List<VehicleType>, JobType>(
  (Ref ref, JobType jobType) => ref.watch(catalogRepositoryProvider).vehicleTypes(jobType: jobType),
);

final FutureProvider<List<PackageCategory>> packageCategoriesProvider =
    FutureProvider<List<PackageCategory>>((Ref ref) => ref.watch(catalogRepositoryProvider).packageCategories());

final FutureProvider<List<RecentService>> recentServicesProvider =
    FutureProvider<List<RecentService>>((Ref ref) => ref.watch(catalogRepositoryProvider).recentServices());

/// Debounced catalogue search backing the search screen.
final AutoDisposeFutureProviderFamily<List<CatalogSearchHit>, String> catalogSearchProvider =
    FutureProvider.autoDispose.family<List<CatalogSearchHit>, String>((Ref<Object?> ref, String query) async {
  if (query.trim().length < 2) return const <CatalogSearchHit>[];
  bool cancelled = false;
  ref.onDispose(() => cancelled = true);
  await Future<void>.delayed(const Duration(milliseconds: 280));
  if (cancelled) return const <CatalogSearchHit>[];
  return ref.read(catalogRepositoryProvider).search(
        query,
        near: ref.read(currentPointProvider),
        zoneId: ref.read(currentZoneIdProvider),
      );
});

/// Favourite categories, with optimistic invalidation after every toggle.
class FavoritesController extends AsyncNotifier<List<ServiceCategory>> {
  @override
  Future<List<ServiceCategory>> build() => ref.watch(catalogRepositoryProvider).favorites();

  Future<void> toggle(String categoryId, {required bool isFavorite}) async {
    final CatalogRepository repository = ref.read(catalogRepositoryProvider);
    if (isFavorite) {
      await repository.removeFavorite(categoryId);
    } else {
      await repository.addFavorite(categoryId);
    }
    ref.invalidateSelf();
  }
}

final AsyncNotifierProvider<FavoritesController, List<ServiceCategory>> favoritesProvider =
    AsyncNotifierProvider<FavoritesController, List<ServiceCategory>>(FavoritesController.new);
