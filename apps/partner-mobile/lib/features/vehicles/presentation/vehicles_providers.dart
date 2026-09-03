import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/vehicles/data/vehicles_repository.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';

final Provider<VehiclesRepository> vehiclesRepositoryProvider =
    Provider<VehiclesRepository>((Ref ref) => VehiclesRepository(ref.watch(apiClientProvider)));

final FutureProvider<List<Vehicle>> vehiclesProvider =
    FutureProvider<List<Vehicle>>((Ref ref) => ref.watch(vehiclesRepositoryProvider).list());

final FutureProviderFamily<Vehicle, String> vehicleProvider =
    FutureProvider.family<Vehicle, String>((Ref ref, String id) => ref.watch(vehiclesRepositoryProvider).get(id));

final FutureProviderFamily<List<PartnerDocument>, String> vehicleDocumentsProvider =
    FutureProvider.family<List<PartnerDocument>, String>(
  (Ref ref, String id) => ref.watch(vehiclesRepositoryProvider).documents(id),
);

/// The vehicle currently marked active, or `null`.
final Provider<Vehicle?> activeVehicleProvider = Provider<Vehicle?>((Ref ref) {
  final List<Vehicle> vehicles = ref.watch(vehiclesProvider).valueOrNull ?? const <Vehicle>[];
  for (final Vehicle vehicle in vehicles) {
    if (vehicle.isActive) return vehicle;
  }
  return null;
});
