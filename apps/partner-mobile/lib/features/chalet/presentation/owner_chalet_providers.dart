import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/chalet/data/owner_chalet_repository.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';

final Provider<OwnerChaletRepository> ownerChaletRepositoryProvider =
    Provider<OwnerChaletRepository>(
  (Ref ref) => OwnerChaletRepository(ref.watch(apiClientProvider)),
);

/// The chalets this owner has. Empty for a partner who owns none, which is
/// what keeps the dashboard out of the way of drivers and technicians.
class OwnerChaletsController extends AsyncNotifier<List<OwnerChalet>> {
  @override
  Future<List<OwnerChalet>> build() => ref.watch(ownerChaletRepositoryProvider).myChalets();

  Future<void> setAutomation(String chaletId, Map<String, bool> switches) async {
    await ref.read(ownerChaletRepositoryProvider).setAutomation(chaletId, switches);
    ref.invalidateSelf();
  }
}

final AsyncNotifierProvider<OwnerChaletsController, List<OwnerChalet>> ownerChaletsProvider =
    AsyncNotifierProvider<OwnerChaletsController, List<OwnerChalet>>(OwnerChaletsController.new);

final FutureProviderFamily<ChaletOccupancy, String> chaletOccupancyProvider =
    FutureProvider.family<ChaletOccupancy, String>(
  (Ref ref, String chaletId) =>
      ref.watch(ownerChaletRepositoryProvider).occupancy(chaletId, toDate: DateTime.now()),
);

final FutureProviderFamily<List<OwnerBooking>, String> chaletBookingsProvider =
    FutureProvider.family<List<OwnerBooking>, String>(
  (Ref ref, String chaletId) => ref.watch(ownerChaletRepositoryProvider).bookings(chaletId),
);

/// Which day the gap list is looking at.
class ChaletGapQuery {
  const ChaletGapQuery({required this.chaletId, required this.date});

  final String chaletId;
  final DateTime date;

  @override
  bool operator ==(Object other) =>
      other is ChaletGapQuery &&
      other.chaletId == chaletId &&
      other.date.year == date.year &&
      other.date.month == date.month &&
      other.date.day == date.day;

  @override
  int get hashCode => Object.hash(chaletId, date.year, date.month, date.day);
}

final FutureProviderFamily<List<ChaletGap>, ChaletGapQuery> chaletGapsProvider =
    FutureProvider.family<List<ChaletGap>, ChaletGapQuery>(
  (Ref ref, ChaletGapQuery query) =>
      ref.watch(ownerChaletRepositoryProvider).gaps(query.chaletId, date: query.date),
);
