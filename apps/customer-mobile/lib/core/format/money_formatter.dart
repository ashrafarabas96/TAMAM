import 'package:intl/intl.dart';
import 'package:tamam_customer/core/models/money.dart';

/// Renders [Money] (integer minor units) for a given locale.
///
/// The app never *computes* prices — it only formats what the API returned —
/// so the only knowledge encoded here is how many minor units a currency has
/// and which symbol to draw.
class MoneyFormatter {
  const MoneyFormatter(this.localeName);

  /// Minor-unit exponents for the supported currencies (ISO-4217).
  static const Map<String, int> _decimals = <String, int>{'ILS': 2, 'USD': 2, 'JOD': 3};
  static const Map<String, String> _symbols = <String, String>{'ILS': '₪', 'USD': r'$', 'JOD': 'JD'};

  final String localeName;

  static int decimalsFor(String currency) => _decimals[currency.toUpperCase()] ?? 2;

  static String symbolFor(String currency) => _symbols[currency.toUpperCase()] ?? currency.toUpperCase();

  /// Converts minor units into the major-unit value used for display only.
  static double toMajor(Money money) => money.amount / _pow10(decimalsFor(money.currency));

  /// `₪ 35.00` / `35.00 ₪` — [NumberFormat] places the symbol per locale.
  String format(Money money, {bool showSymbol = true}) {
    final int digits = decimalsFor(money.currency);
    final NumberFormat formatter = NumberFormat.currency(
      locale: localeName,
      symbol: showSymbol ? symbolFor(money.currency) : '',
      decimalDigits: digits,
    );
    return formatter.format(toMajor(money)).trim();
  }

  /// Signed variant used in ledger rows: `+₪ 20.00` / `-₪ 20.00`.
  String formatSigned(Money money) {
    final String base = format(Money(amount: money.amount.abs(), currency: money.currency));
    return money.amount < 0 ? '-$base' : '+$base';
  }

  /// Compact form for tight spots (chips, map pills): drops `.00`.
  String formatCompact(Money money) {
    final int digits = decimalsFor(money.currency);
    final double major = toMajor(money);
    final bool whole = money.amount % _pow10(digits) == 0;
    final NumberFormat formatter = NumberFormat.currency(
      locale: localeName,
      symbol: symbolFor(money.currency),
      decimalDigits: whole ? 0 : digits,
    );
    return formatter.format(major).trim();
  }

  static int _pow10(int exponent) {
    int result = 1;
    for (int i = 0; i < exponent; i++) {
      result *= 10;
    }
    return result;
  }
}
