import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';

/// `today` / `week` / `month` — the periods `GET /partners/me/earnings` accepts.
enum EarningsPeriod {
  today('today'),
  week('week'),
  month('month');

  const EarningsPeriod(this.value);

  final String value;

  static EarningsPeriod fromValue(String? value) {
    for (final EarningsPeriod period in EarningsPeriod.values) {
      if (period.value == value) return period;
    }
    return EarningsPeriod.today;
  }
}

/// `PartnerEarningsDto` — every number is server-computed.
class PartnerEarnings {
  const PartnerEarnings({
    required this.period,
    required this.currency,
    required this.completedJobs,
    required this.grossEarnings,
    required this.commission,
    required this.bonuses,
    required this.adjustments,
    required this.netEarnings,
    required this.withdrawals,
    required this.currentBalance,
  });

  factory PartnerEarnings.fromJson(JsonMap json) {
    final String currency = readStringOr(json, 'currency', 'ILS');
    Money money(String key) => readObject<Money>(json, key, Money.fromJson) ?? Money.zero(currency);
    return PartnerEarnings(
      period: EarningsPeriod.fromValue(readString(json, 'period')),
      currency: currency,
      completedJobs: readIntOr(json, 'completedJobs', 0),
      grossEarnings: money('grossEarnings'),
      commission: money('commission'),
      bonuses: money('bonuses'),
      adjustments: money('adjustments'),
      netEarnings: money('netEarnings'),
      withdrawals: money('withdrawals'),
      currentBalance: money('currentBalance'),
    );
  }

  final EarningsPeriod period;
  final String currency;
  final int completedJobs;
  final Money grossEarnings;
  final Money commission;
  final Money bonuses;
  final Money adjustments;
  final Money netEarnings;
  final Money withdrawals;
  final Money currentBalance;
}

/// `WalletDto`.
class Wallet {
  const Wallet({required this.id, required this.currency, required this.balance, required this.pendingBalance});

  factory Wallet.fromJson(JsonMap json) {
    final String currency = readStringOr(json, 'currency', 'ILS');
    return Wallet(
      id: readStringOr(json, 'id', ''),
      currency: currency,
      balance: readObject<Money>(json, 'balance', Money.fromJson) ?? Money.zero(currency),
      pendingBalance: readObject<Money>(json, 'pendingBalance', Money.fromJson) ?? Money.zero(currency),
    );
  }

  final String id;
  final String currency;
  final Money balance;
  final Money pendingBalance;
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
        direction: LedgerEntryDirection.fromValue(readString(json, 'direction')) ?? LedgerEntryDirection.credit,
        amount: readObject<Money>(json, 'amount', Money.fromJson) ?? const Money.zero('ILS'),
        balanceAfter: readObject<Money>(json, 'balanceAfter', Money.fromJson) ?? const Money.zero('ILS'),
        description: readStringOr(json, 'description', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        jobId: readString(json, 'jobId'),
      );

  final String id;
  final String transactionType;
  final LedgerEntryDirection direction;
  final Money amount;
  final Money balanceAfter;
  final String description;
  final DateTime createdAt;
  final String? jobId;

  bool get isCredit => direction == LedgerEntryDirection.credit;

  /// Signed for display: credits positive, debits negative.
  Money get signedAmount => isCredit ? amount : Money(amount: -amount.amount, currency: amount.currency);
}

/// `WithdrawalDto`.
class Withdrawal {
  const Withdrawal({
    required this.id,
    required this.status,
    required this.amount,
    required this.fee,
    required this.bankName,
    required this.ibanLast4,
    required this.createdAt,
    this.decisionReason,
    this.paidAt,
  });

  factory Withdrawal.fromJson(JsonMap json) => Withdrawal(
        id: readStringOr(json, 'id', ''),
        status: WithdrawalStatus.fromValue(readString(json, 'status')) ?? WithdrawalStatus.requested,
        amount: readObject<Money>(json, 'amount', Money.fromJson) ?? const Money.zero('ILS'),
        fee: readObject<Money>(json, 'fee', Money.fromJson) ?? const Money.zero('ILS'),
        bankName: readStringOr(json, 'bankName', ''),
        ibanLast4: readStringOr(json, 'ibanLast4', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        decisionReason: readString(json, 'decisionReason'),
        paidAt: readDateTime(json, 'paidAt'),
      );

  final String id;
  final WithdrawalStatus status;
  final Money amount;
  final Money fee;
  final String bankName;
  final String ibanLast4;
  final DateTime createdAt;
  final String? decisionReason;
  final DateTime? paidAt;
}
