import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/earnings/data/earnings_repository.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';

final Provider<EarningsRepository> earningsRepositoryProvider =
    Provider<EarningsRepository>((Ref ref) => EarningsRepository(ref.watch(apiClientProvider)));

final FutureProviderFamily<PartnerEarnings, EarningsPeriod> earningsProvider =
    FutureProvider.family<PartnerEarnings, EarningsPeriod>(
  (Ref ref, EarningsPeriod period) => ref.watch(earningsRepositoryProvider).earnings(period),
);

final FutureProvider<Wallet> walletProvider =
    FutureProvider<Wallet>((Ref ref) => ref.watch(earningsRepositoryProvider).wallet());

/// A cursor-paged list with a shared "load more" shape.
abstract class _PagedController<T> extends AsyncNotifier<CursorPage<T>> {
  bool _loading = false;

  Future<CursorPage<T>> fetch(String? cursor);

  @override
  Future<CursorPage<T>> build() => fetch(null);

  Future<void> loadMore() async {
    final CursorPage<T>? current = state.valueOrNull;
    if (current == null || !current.hasMore || _loading) return;
    _loading = true;
    try {
      state = AsyncValue<CursorPage<T>>.data(current.concat(await fetch(current.nextCursor)));
    } on AppFailure {
      // The next scroll retries.
    } finally {
      _loading = false;
    }
  }
}

class StatementController extends _PagedController<LedgerEntry> {
  @override
  Future<CursorPage<LedgerEntry>> fetch(String? cursor) =>
      ref.read(earningsRepositoryProvider).statement(cursor: cursor);
}

final AsyncNotifierProvider<StatementController, CursorPage<LedgerEntry>> statementProvider =
    AsyncNotifierProvider<StatementController, CursorPage<LedgerEntry>>(StatementController.new);

class WithdrawalsController extends _PagedController<Withdrawal> {
  @override
  Future<CursorPage<Withdrawal>> fetch(String? cursor) =>
      ref.read(earningsRepositoryProvider).withdrawals(cursor: cursor);
}

final AsyncNotifierProvider<WithdrawalsController, CursorPage<Withdrawal>> withdrawalsProvider =
    AsyncNotifierProvider<WithdrawalsController, CursorPage<Withdrawal>>(WithdrawalsController.new);
