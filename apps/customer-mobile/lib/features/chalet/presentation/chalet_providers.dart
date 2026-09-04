import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/chalet/data/chalet_repository.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';

final Provider<ChaletRepository> chaletRepositoryProvider =
    Provider<ChaletRepository>((Ref ref) => ChaletRepository(ref.watch(apiClientProvider)));

/// What the customer has narrowed the list to.
class ChaletSearchFilters {
  const ChaletSearchFilters({this.city, this.guestCount, this.startAt, this.endAt});

  final String? city;
  final int? guestCount;
  final DateTime? startAt;
  final DateTime? endAt;

  ChaletSearchFilters copyWith({
    String? city,
    int? guestCount,
    DateTime? startAt,
    DateTime? endAt,
    bool clearWindow = false,
  }) =>
      ChaletSearchFilters(
        city: city ?? this.city,
        guestCount: guestCount ?? this.guestCount,
        startAt: clearWindow ? null : (startAt ?? this.startAt),
        endAt: clearWindow ? null : (endAt ?? this.endAt),
      );

  @override
  bool operator ==(Object other) =>
      other is ChaletSearchFilters &&
      other.city == city &&
      other.guestCount == guestCount &&
      other.startAt == startAt &&
      other.endAt == endAt;

  @override
  int get hashCode => Object.hash(city, guestCount, startAt, endAt);
}

final NotifierProvider<ChaletFiltersController, ChaletSearchFilters> chaletFiltersProvider =
    NotifierProvider<ChaletFiltersController, ChaletSearchFilters>(ChaletFiltersController.new);

class ChaletFiltersController extends Notifier<ChaletSearchFilters> {
  @override
  ChaletSearchFilters build() => const ChaletSearchFilters();

  void setGuests(int? guests) => state = ChaletSearchFilters(
        city: state.city,
        guestCount: guests,
        startAt: state.startAt,
        endAt: state.endAt,
      );

  void setCity(String? city) => state = ChaletSearchFilters(
        city: city,
        guestCount: state.guestCount,
        startAt: state.startAt,
        endAt: state.endAt,
      );

  void clear() => state = const ChaletSearchFilters();
}

final FutureProviderFamily<List<ChaletSummary>, ChaletSearchFilters> chaletSearchProvider =
    FutureProvider.family<List<ChaletSummary>, ChaletSearchFilters>((Ref ref, ChaletSearchFilters filters) {
  return ref.watch(chaletRepositoryProvider).search(
        city: filters.city,
        guestCount: filters.guestCount,
        startAt: filters.startAt,
        endAt: filters.endAt,
      );
});

final FutureProviderFamily<ChaletDetail, String> chaletDetailProvider =
    FutureProvider.family<ChaletDetail, String>(
  (Ref ref, String chaletId) => ref.watch(chaletRepositoryProvider).detail(chaletId),
);

/// Which day and how long the picker is currently asking about.
class ChaletSlotQuery {
  const ChaletSlotQuery({required this.chaletId, required this.date, required this.durationMinutes});

  final String chaletId;
  final DateTime date;
  final int durationMinutes;

  @override
  bool operator ==(Object other) =>
      other is ChaletSlotQuery &&
      other.chaletId == chaletId &&
      other.durationMinutes == durationMinutes &&
      other.date.year == date.year &&
      other.date.month == date.month &&
      other.date.day == date.day;

  @override
  int get hashCode => Object.hash(chaletId, durationMinutes, date.year, date.month, date.day);
}

final FutureProviderFamily<ChaletAvailability, ChaletSlotQuery> chaletAvailabilityProvider =
    FutureProvider.family<ChaletAvailability, ChaletSlotQuery>((Ref ref, ChaletSlotQuery query) {
  return ref.watch(chaletRepositoryProvider).availability(
        query.chaletId,
        date: query.date,
        durationMinutes: query.durationMinutes,
      );
});

/// The exact window the customer has selected, if any.
class ChaletSelection {
  const ChaletSelection({required this.startAt, required this.durationMinutes, required this.guestCount});

  final DateTime startAt;
  final int durationMinutes;
  final int guestCount;

  DateTime get endAt => startAt.add(Duration(minutes: durationMinutes));

  @override
  bool operator ==(Object other) =>
      other is ChaletSelection &&
      other.startAt == startAt &&
      other.durationMinutes == durationMinutes &&
      other.guestCount == guestCount;

  @override
  int get hashCode => Object.hash(startAt, durationMinutes, guestCount);
}

/// Prices the selected window, and says whether it is still free.
///
/// Re-read whenever the selection changes rather than cached: between choosing
/// a slot and paying for it, somebody else may have taken it.
final FutureProviderFamily<ChaletSlotCheck, ({String chaletId, ChaletSelection selection})>
    chaletSlotCheckProvider =
    FutureProvider.family<ChaletSlotCheck, ({String chaletId, ChaletSelection selection})>(
        (Ref ref, ({String chaletId, ChaletSelection selection}) args) {
  return ref.watch(chaletRepositoryProvider).checkSlot(
        args.chaletId,
        startAt: args.selection.startAt,
        endAt: args.selection.endAt,
      );
});

/// Holding, confirming and cancelling. The screen watches this for its state.
class ChaletBookingController extends AsyncNotifier<ChaletBooking?> {
  @override
  Future<ChaletBooking?> build() async => null;

  Future<ChaletBooking> hold({
    required String chaletId,
    required ChaletSelection selection,
  }) async {
    state = const AsyncValue<ChaletBooking?>.loading();
    try {
      final ChaletBooking booking = await ref.read(chaletRepositoryProvider).hold(
            chaletId: chaletId,
            startAt: selection.startAt,
            endAt: selection.endAt,
            guestCount: selection.guestCount,
          );
      state = AsyncValue<ChaletBooking?>.data(booking);
      return booking;
    } catch (error, stack) {
      state = AsyncValue<ChaletBooking?>.error(error, stack);
      rethrow;
    }
  }

  Future<ChaletBooking> confirm(String bookingId) async {
    final ChaletBooking booking = await ref.read(chaletRepositoryProvider).confirm(bookingId);
    state = AsyncValue<ChaletBooking?>.data(booking);
    return booking;
  }

  Future<void> cancel(String bookingId, String reason) async {
    await ref.read(chaletRepositoryProvider).cancel(bookingId, reason);
    state = const AsyncValue<ChaletBooking?>.data(null);
  }

  /// Clears the held booking without touching the server — used when a screen
  /// is left and the hold is allowed to lapse on its own.
  void forget() => state = const AsyncValue<ChaletBooking?>.data(null);
}

final AsyncNotifierProvider<ChaletBookingController, ChaletBooking?> chaletBookingProvider =
    AsyncNotifierProvider<ChaletBookingController, ChaletBooking?>(ChaletBookingController.new);
