import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';

/// The customer's wallet (`WalletDto`).
class Wallet {
  const Wallet({
    required this.id,
    required this.currency,
    required this.balance,
    required this.pendingBalance,
    required this.updatedAt,
  });

  factory Wallet.fromJson(JsonMap json) => Wallet(
        id: readStringOr(json, 'id', ''),
        currency: readStringOr(json, 'currency', 'ILS'),
        balance: readObject<Money>(json, 'balance', Money.fromJson) ?? const Money.zero('ILS'),
        pendingBalance: readObject<Money>(json, 'pendingBalance', Money.fromJson) ?? const Money.zero('ILS'),
        updatedAt: readDateTimeOr(json, 'updatedAt', DateTime.now()),
      );

  final String id;
  final String currency;
  final Money balance;

  /// Authorised but not yet settled — shown as "قيد التسوية".
  final Money pendingBalance;
  final DateTime updatedAt;

  bool get hasPending => pendingBalance.amount != 0;
}

/// One statement row (`LedgerEntryDto`).
class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.transactionType,
    required this.direction,
    required this.amount,
    required this.balanceAfter,
    required this.description,
    required this.createdAt,
    this.jobId,
  });

  factory LedgerEntry.fromJson(JsonMap json) => LedgerEntry(
        id: readStringOr(json, 'id', ''),
        transactionType: readStringOr(json, 'transactionType', ''),
        direction: readStringOr(json, 'direction', 'DEBIT'),
        amount: readObject<Money>(json, 'amount', Money.fromJson) ?? const Money.zero('ILS'),
        balanceAfter: readObject<Money>(json, 'balanceAfter', Money.fromJson) ?? const Money.zero('ILS'),
        description: readStringOr(json, 'description', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        jobId: readString(json, 'jobId'),
      );

  final String id;
  final String transactionType;

  /// `CREDIT` adds to the balance, `DEBIT` removes from it.
  final String direction;
  final Money amount;
  final Money balanceAfter;
  final String description;
  final DateTime createdAt;
  final String? jobId;

  bool get isCredit => direction == 'CREDIT';

  /// Signed amount for display; the API always sends a positive magnitude.
  Money get signedAmount => Money(amount: isCredit ? amount.amount : -amount.amount, currency: amount.currency);
}

/// Referral programme summary (`GET /referrals/me`).
class ReferralInfo {
  const ReferralInfo({
    required this.code,
    required this.shareUrl,
    required this.shareText,
    required this.invitedCount,
    required this.rewardedCount,
    this.inviteeReward,
  });

  factory ReferralInfo.fromJson(JsonMap json) {
    final JsonMap? program = asJsonMap(json['program']);
    return ReferralInfo(
      code: readStringOr(json, 'code', ''),
      shareUrl: readStringOr(json, 'shareUrl', ''),
      shareText: LocalizedText.required(json, 'shareText'),
      invitedCount: readIntOr(json, 'invitedCount', 0),
      rewardedCount: readIntOr(json, 'rewardedCount', 0),
      inviteeReward: program == null ? null : readObject<Money>(program, 'inviteeReward', Money.fromJson),
    );
  }

  final String code;
  final String shareUrl;
  final LocalizedText shareText;
  final int invitedCount;
  final int rewardedCount;
  final Money? inviteeReward;
}

/// Wallet, statement and top-up.
class WalletRepository {
  const WalletRepository(this._api);

  final ApiClient _api;

  Future<Wallet> wallet() async => Wallet.fromJson(await _api.getObject(ApiPaths.wallet));

  Future<CursorPage<LedgerEntry>> statement({String? cursor, int limit = 20}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.walletStatement,
      query: <String, Object?>{'cursor': cursor, 'limit': limit},
    );
    return CursorPage<LedgerEntry>.fromJson(json, LedgerEntry.fromJson);
  }

  /// Starts a top-up. Gateways return a URL the app opens; the balance updates
  /// once the provider's webhook settles, never from the client.
  Future<TopUpIntent> topUp({required Money amount, required String method, String? returnUrl}) async {
    final JsonMap json = await _api.postObject(
      ApiPaths.walletTopUp,
      body: <String, Object?>{
        'amount': amount.toJson(),
        'method': method,
        if (returnUrl != null) 'returnUrl': returnUrl,
      },
    );
    return TopUpIntent(
      paymentId: readString(json, 'paymentId') ?? readStringOr(json, 'id', ''),
      redirectUrl: readString(json, 'redirectUrl') ?? readString(json, 'checkoutUrl'),
      status: readString(json, 'status'),
    );
  }

  Future<ReferralInfo> referral() async => ReferralInfo.fromJson(await _api.getObject(ApiPaths.referralsMe));
}

/// What the app got back when starting a top-up.
class TopUpIntent {
  const TopUpIntent({required this.paymentId, this.redirectUrl, this.status});

  final String paymentId;

  /// Present when the provider needs a hosted checkout page.
  final String? redirectUrl;
  final String? status;
}
