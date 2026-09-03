import 'package:tamam_partner/core/models/json.dart';

/// Money is always integer minor units plus an ISO currency code (spec §50).
///
/// The client never does arithmetic that affects what a customer is charged —
/// totals and breakdowns always come from the API. The only arithmetic allowed
/// here is presentational (scaling minor units into major units for display).
class Money {
  const Money({required this.amount, required this.currency});

  factory Money.fromJson(JsonMap json) => Money(
        amount: readIntOr(json, 'amount', 0),
        currency: readStringOr(json, 'currency', 'ILS'),
      );

  /// Zero in [currency] — used for placeholders while a total is unknown.
  const Money.zero(this.currency) : amount = 0;

  /// Integer minor units (agorot / cents / fils).
  final int amount;

  /// ISO-4217 code: ILS, USD or JOD.
  final String currency;

  bool get isZero => amount == 0;
  bool get isNegative => amount < 0;

  JsonMap toJson() => <String, Object?>{'amount': amount, 'currency': currency};

  @override
  bool operator ==(Object other) => other is Money && other.amount == amount && other.currency == currency;

  @override
  int get hashCode => Object.hash(amount, currency);

  @override
  String toString() => '$amount $currency';
}
