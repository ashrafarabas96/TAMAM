import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/catalog/data/catalog_repository.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';

final Provider<CatalogRepository> catalogRepositoryProvider =
    Provider<CatalogRepository>((Ref ref) => CatalogRepository(ref.watch(apiClientProvider)));

/// Home-service categories (skills). Cached for the session; the wizard and the
/// work-preferences screen both read it.
final FutureProvider<List<ServiceCategory>> serviceCategoriesProvider =
    FutureProvider<List<ServiceCategory>>((Ref ref) => ref.watch(catalogRepositoryProvider).categories());

final FutureProvider<List<VehicleType>> vehicleTypesProvider =
    FutureProvider<List<VehicleType>>((Ref ref) => ref.watch(catalogRepositoryProvider).vehicleTypes());

final FutureProvider<List<ServiceZone>> serviceZonesProvider =
    FutureProvider<List<ServiceZone>>((Ref ref) => ref.watch(catalogRepositoryProvider).zones());
