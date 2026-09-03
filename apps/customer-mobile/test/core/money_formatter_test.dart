import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/format/money_formatter.dart';
import 'package:tamam_customer/core/models/money.dart';

void main() {
  group('MoneyFormatter', () {
    test('knows each supported currency exponent', () {
      expect(MoneyFormatter.decimalsFor('ILS'), 2);
      expect(MoneyFormatter.decimalsFor('USD'), 2);
      expect(MoneyFormatter.decimalsFor('JOD'), 3);
      // An unknown code must not crash the app; two decimals is the safe default.
      expect(MoneyFormatter.decimalsFor('XYZ'), 2);
    });

    test('converts minor units to major units without floating drift', () {
      expect(MoneyFormatter.toMajor(const Money(amount: 3550, currency: 'ILS')), closeTo(35.5, 1e-9));
      expect(MoneyFormatter.toMajor(const Money(amount: 1234, currency: 'JOD')), closeTo(1.234, 1e-9));
      expect(MoneyFormatter.toMajor(const Money(amount: 0, currency: 'ILS')), 0);
    });

    test('formats with the currency symbol and the right number of decimals', () {
      const MoneyFormatter formatter = MoneyFormatter('en');
      final String ils = formatter.format(const Money(amount: 3550, currency: 'ILS'));
      expect(ils, contains('₪'));
      expect(ils, contains('35.50'));

      final String jod = formatter.format(const Money(amount: 1234, currency: 'JOD'));
      expect(jod, contains('1.234'));
    });

    test('drops empty decimals only in the compact form', () {
      const MoneyFormatter formatter = MoneyFormatter('en');
      expect(formatter.formatCompact(const Money(amount: 4000, currency: 'ILS')), contains('40'));
      expect(formatter.formatCompact(const Money(amount: 4000, currency: 'ILS')), isNot(contains('.00')));
      expect(formatter.formatCompact(const Money(amount: 4050, currency: 'ILS')), contains('40.50'));
    });

    test('signs ledger amounts by their direction', () {
      const MoneyFormatter formatter = MoneyFormatter('en');
      expect(formatter.formatSigned(const Money(amount: 2000, currency: 'ILS')), startsWith('+'));
      expect(formatter.formatSigned(const Money(amount: -2000, currency: 'ILS')), startsWith('-'));
    });

    test('hides the symbol when asked', () {
      const MoneyFormatter formatter = MoneyFormatter('en');
      expect(formatter.format(const Money(amount: 1000, currency: 'ILS'), showSymbol: false), isNot(contains('₪')));
    });
  });

  group('Money', () {
    test('parses the DTO shape', () {
      final Money money = Money.fromJson(<String, Object?>{'amount': 750, 'currency': 'ILS'});
      expect(money.amount, 750);
      expect(money.currency, 'ILS');
    });

    test('falls back safely on a malformed payload', () {
      final Money money = Money.fromJson(<String, Object?>{});
      expect(money.amount, 0);
      expect(money.currency, 'ILS');
    });

    test('compares by value', () {
      expect(const Money(amount: 100, currency: 'ILS'), const Money(amount: 100, currency: 'ILS'));
      expect(const Money(amount: 100, currency: 'ILS'), isNot(const Money(amount: 100, currency: 'USD')));
    });
  });
}
