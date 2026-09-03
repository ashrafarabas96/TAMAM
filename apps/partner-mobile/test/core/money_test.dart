import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/format/money_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';

/// Money is integer minor units end to end. These tests pin down the only two
/// things the client is allowed to do with it: scale it for display, and format
/// it for a locale. Anything that changes what a customer is charged belongs to
/// the server.
void main() {
  // No locale data is loaded here on purpose: `NumberFormat`'s symbols ship
  // with `intl`, so money formatting must work without `initializeDateFormatting`.
  group('Money', () {
    test('parses minor units and currency from JSON', () {
      final Money money = Money.fromJson(<String, Object?>{'amount': 3550, 'currency': 'ILS'});

      expect(money.amount, 3550);
      expect(money.currency, 'ILS');
      expect(money.isZero, isFalse);
      expect(money.isNegative, isFalse);
    });

    test('falls back to zero ILS for a malformed payload', () {
      final Money money = Money.fromJson(const <String, Object?>{});

      expect(money.amount, 0);
      expect(money.currency, 'ILS');
      expect(money.isZero, isTrue);
    });

    test('round-trips through JSON unchanged', () {
      const Money money = Money(amount: -1250, currency: 'USD');

      expect(Money.fromJson(money.toJson()), money);
      expect(money.isNegative, isTrue);
    });

    test('equality is by amount and currency together', () {
      expect(const Money(amount: 100, currency: 'ILS'), const Money(amount: 100, currency: 'ILS'));
      expect(const Money(amount: 100, currency: 'ILS'), isNot(const Money(amount: 100, currency: 'USD')));
    });
  });

  group('MoneyFormatter.toMajor', () {
    test('uses the ISO-4217 exponent of each currency', () {
      // JOD has three minor digits, ILS and USD have two.
      expect(MoneyFormatter.toMajor(const Money(amount: 3550, currency: 'ILS')), closeTo(35.50, 1e-9));
      expect(MoneyFormatter.toMajor(const Money(amount: 3550, currency: 'USD')), closeTo(35.50, 1e-9));
      expect(MoneyFormatter.toMajor(const Money(amount: 3550, currency: 'JOD')), closeTo(3.550, 1e-9));
    });

    test('treats an unknown currency as two decimals', () {
      expect(MoneyFormatter.decimalsFor('XYZ'), 2);
      expect(MoneyFormatter.symbolFor('XYZ'), 'XYZ');
    });

    test('is case-insensitive about the currency code', () {
      expect(MoneyFormatter.decimalsFor('jod'), 3);
      expect(MoneyFormatter.symbolFor('ils'), '₪');
    });
  });

  group('MoneyFormatter.format', () {
    test('renders the symbol and the currency decimals', () {
      const MoneyFormatter formatter = MoneyFormatter('en');

      expect(formatter.format(const Money(amount: 3550, currency: 'ILS')), contains('35.50'));
      expect(formatter.format(const Money(amount: 3550, currency: 'ILS')), contains('₪'));
      expect(formatter.format(const Money(amount: 3550, currency: 'JOD')), contains('3.550'));
    });

    test('can drop the symbol for tight layouts', () {
      const MoneyFormatter formatter = MoneyFormatter('en');
      final String bare = formatter.format(const Money(amount: 3550, currency: 'ILS'), showSymbol: false);

      expect(bare, contains('35.50'));
      expect(bare, isNot(contains('₪')));
    });

    test('formatCompact drops trailing zeros only for whole amounts', () {
      const MoneyFormatter formatter = MoneyFormatter('en');

      expect(formatter.formatCompact(const Money(amount: 3500, currency: 'ILS')), contains('35'));
      expect(formatter.formatCompact(const Money(amount: 3500, currency: 'ILS')), isNot(contains('35.00')));
      expect(formatter.formatCompact(const Money(amount: 3550, currency: 'ILS')), contains('35.50'));
    });

    test('formatSigned marks the direction of a ledger movement', () {
      const MoneyFormatter formatter = MoneyFormatter('en');

      expect(formatter.formatSigned(const Money(amount: 2000, currency: 'ILS')), startsWith('+'));
      expect(formatter.formatSigned(const Money(amount: -2000, currency: 'ILS')), startsWith('-'));
      // A negative amount is rendered from its absolute value, so the minus
      // sign is never doubled.
      expect(formatter.formatSigned(const Money(amount: -2000, currency: 'ILS')), isNot(contains('--')));
    });

    test('zero formats without a sign', () {
      const MoneyFormatter formatter = MoneyFormatter('en');

      expect(formatter.formatSigned(const Money.zero('ILS')), startsWith('+'));
      expect(formatter.format(const Money.zero('ILS')), contains('0.00'));
    });
  });
}
