import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';

/// Earnings, wallet statement and withdrawals.
class EarningsRepository {
  const EarningsRepository(this._api);

  static const String _owner = 'PARTNER';

  final ApiClient _api;

  Future<PartnerEarnings> earnings(EarningsPeriod period) async => PartnerEarnings.fromJson(
        await _api.getObject(ApiPaths.partnerEarnings, query: <String, Object?>{'period': period.value}),
      );

  Future<Wallet> wallet() async =>
      Wallet.fromJson(await _api.getObject(ApiPaths.wallet, query: <String, Object?>{'owner': _owner}));

  Future<CursorPage<LedgerEntry>> statement({String? cursor, int limit = 30}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.walletStatement,
      query: <String, Object?>{'owner': _owner, 'cursor': cursor, 'limit': limit},
    );
    return CursorPage<LedgerEntry>.fromJson(json, LedgerEntry.fromJson);
  }

  Future<CursorPage<Withdrawal>> withdrawals({String? cursor, int limit = 30}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.walletWithdrawals,
      query: <String, Object?>{'cursor': cursor, 'limit': limit},
    );
    return CursorPage<Withdrawal>.fromJson(json, Withdrawal.fromJson);
  }

  /// `POST /wallet/withdrawals` — idempotent per [idempotencyKey], so a retry
  /// after a timeout never withdraws twice.
  Future<Withdrawal> requestWithdrawal({
    required int amountMinor,
    required String bankAccountId,
    required String idempotencyKey,
  }) async =>
      Withdrawal.fromJson(
        await _api.postObject(
          ApiPaths.walletWithdrawals,
          body: <String, Object?>{'amountMinor': amountMinor, 'bankAccountId': bankAccountId},
          idempotencyKey: idempotencyKey,
        ),
      );
}
