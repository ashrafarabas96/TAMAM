import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/wallet/data/wallet_repository.dart';

final Provider<WalletRepository> walletRepositoryProvider =
    Provider<WalletRepository>((Ref ref) => WalletRepository(ref.watch(apiClientProvider)));

final FutureProvider<Wallet> walletProvider =
    FutureProvider<Wallet>((Ref ref) => ref.watch(walletRepositoryProvider).wallet());

final FutureProvider<ReferralInfo> referralProvider =
    FutureProvider<ReferralInfo>((Ref ref) => ref.watch(walletRepositoryProvider).referral());

/// The wallet statement, paginated by cursor.
class StatementController extends AsyncNotifier<List<LedgerEntry>> {
  String? _cursor;

  @override
  Future<List<LedgerEntry>> build() async {
    final CursorPage<LedgerEntry> page = await ref.watch(walletRepositoryProvider).statement();
    _cursor = page.nextCursor;
    return page.items;
  }

  bool get hasMore => _cursor != null && _cursor!.isNotEmpty;

  Future<void> loadMore() async {
    final List<LedgerEntry>? current = state.valueOrNull;
    if (current == null || !hasMore) return;
    try {
      final CursorPage<LedgerEntry> page =
          await ref.read(walletRepositoryProvider).statement(cursor: _cursor);
      _cursor = page.nextCursor;
      state = AsyncValue<List<LedgerEntry>>.data(<LedgerEntry>[...current, ...page.items]);
    } on AppFailure {
      // The list keeps what it has; scrolling again retries.
    }
  }
}

final AsyncNotifierProvider<StatementController, List<LedgerEntry>> statementProvider =
    AsyncNotifierProvider<StatementController, List<LedgerEntry>>(StatementController.new);
