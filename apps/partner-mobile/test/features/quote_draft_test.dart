import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/features/quotes/domain/quote_draft.dart';

QuoteDraftItem _item(
  QuoteItemKind kind, {
  double quantity = 1,
  int unitPriceMinor = 1000,
  String description = 'بند',
}) =>
    QuoteDraftItem(
      kind: kind,
      description: description,
      quantity: quantity,
      unitPriceMinor: unitPriceMinor,
    );

/// The quote builder shows a running total while the partner types. It is a
/// *preview*: the server recomputes tax and fees on submit and its numbers win.
/// These tests pin down the preview arithmetic so the number on screen never
/// contradicts the one the partner is about to send.
void main() {
  group('QuoteDraftItem.lineTotalMinor', () {
    test('multiplies a decimal quantity by an integer unit price', () {
      // 2.5 hours at ₪40.00 = ₪100.00
      expect(_item(QuoteItemKind.labor, quantity: 2.5, unitPriceMinor: 4000).lineTotalMinor, 10000);
    });

    test('rounds half-up on the minor unit, like the server does', () {
      // 0.333 × 1000 = 333.0 → 333
      expect(_item(QuoteItemKind.parts, quantity: 0.333, unitPriceMinor: 1000).lineTotalMinor, 333);
      // 1.5 × 5 = 7.5 → 8
      expect(_item(QuoteItemKind.parts, quantity: 1.5, unitPriceMinor: 5).lineTotalMinor, 8);
    });

    test('a zero unit price is a valid free line', () {
      final QuoteDraftItem free = _item(QuoteItemKind.fee, unitPriceMinor: 0);

      expect(free.lineTotalMinor, 0);
      expect(free.isComplete, isTrue);
    });

    test('is incomplete without a description or a positive quantity', () {
      expect(_item(QuoteItemKind.labor, description: ' ').isComplete, isFalse);
      expect(_item(QuoteItemKind.labor, description: 'a').isComplete, isFalse);
      expect(_item(QuoteItemKind.labor, quantity: 0).isComplete, isFalse);
      expect(_item(QuoteItemKind.labor).isComplete, isTrue);
    });
  });

  group('QuoteDraft totals', () {
    test('sums each kind into its own bucket', () {
      const QuoteDraft empty = QuoteDraft(currency: 'ILS');
      final QuoteDraft draft = empty
          .addItem(_item(QuoteItemKind.labor, quantity: 2, unitPriceMinor: 5000))
          .addItem(_item(QuoteItemKind.labor, quantity: 1, unitPriceMinor: 2500))
          .addItem(_item(QuoteItemKind.parts, quantity: 3, unitPriceMinor: 1000))
          .addItem(_item(QuoteItemKind.fee, quantity: 1, unitPriceMinor: 1500));

      expect(draft.laborMinor, 12500);
      expect(draft.partsMinor, 3000);
      expect(draft.feesMinor, 1500);
      expect(draft.subtotalMinor, 17000);
    });

    test('carries the job currency onto every derived Money', () {
      final QuoteDraft draft =
          const QuoteDraft(currency: 'JOD').addItem(_item(QuoteItemKind.labor, unitPriceMinor: 5000));

      expect(draft.labor, const Money(amount: 5000, currency: 'JOD'));
      expect(draft.previewTotal.currency, 'JOD');
    });

    test('subtracts the discount from the subtotal', () {
      final QuoteDraft draft = const QuoteDraft(currency: 'ILS')
          .addItem(_item(QuoteItemKind.labor, unitPriceMinor: 10000))
          .copyWith(discountMinor: 2500);

      expect(draft.previewTotalMinor, 7500);
      expect(draft.discountExceedsSubtotal, isFalse);
    });

    test('never turns a large discount into a payout', () {
      final QuoteDraft draft = const QuoteDraft(currency: 'ILS')
          .addItem(_item(QuoteItemKind.labor, unitPriceMinor: 5000))
          .copyWith(discountMinor: 9000);

      expect(draft.previewTotalMinor, 0);
      expect(draft.discountExceedsSubtotal, isTrue);
      expect(draft.canSubmit, isFalse);
    });

    test('an empty draft totals zero and cannot be submitted', () {
      const QuoteDraft draft = QuoteDraft(currency: 'ILS');

      expect(draft.subtotalMinor, 0);
      expect(draft.previewTotalMinor, 0);
      expect(draft.canSubmit, isFalse);
    });
  });

  group('QuoteDraft item editing', () {
    test('replaces and removes by index, ignoring out-of-range indices', () {
      final QuoteDraft draft = const QuoteDraft(currency: 'ILS')
          .addItem(_item(QuoteItemKind.labor, unitPriceMinor: 1000))
          .addItem(_item(QuoteItemKind.parts, unitPriceMinor: 2000));

      final QuoteDraft replaced = draft.replaceItem(1, _item(QuoteItemKind.parts, unitPriceMinor: 500));
      expect(replaced.partsMinor, 500);

      expect(draft.replaceItem(9, _item(QuoteItemKind.fee)).items.length, 2);
      expect(draft.removeItem(-1).items.length, 2);
      expect(draft.removeItem(0).items.length, 1);
      expect(draft.removeItem(0).laborMinor, 0);
    });

    test('stops accepting items at the schema maximum', () {
      QuoteDraft draft = const QuoteDraft(currency: 'ILS');
      for (int i = 0; i < QuoteDraft.maxItems + 5; i++) {
        draft = draft.addItem(_item(QuoteItemKind.labor));
      }

      expect(draft.items.length, QuoteDraft.maxItems);
    });

    test('canSubmit requires every line to be complete', () {
      final QuoteDraft good = const QuoteDraft(currency: 'ILS').addItem(_item(QuoteItemKind.labor));
      final QuoteDraft bad = good.addItem(_item(QuoteItemKind.parts, quantity: 0));

      expect(good.canSubmit, isTrue);
      expect(bad.canSubmit, isFalse);
    });
  });

  group('QuoteDraft.toRequestBody', () {
    test('sends minor units, the kind and the optimistic version', () {
      final QuoteDraft draft = const QuoteDraft(currency: 'ILS')
          .addItem(_item(QuoteItemKind.labor, quantity: 2, unitPriceMinor: 5000, description: '  تركيب  '))
          .copyWith(discountMinor: 500, description: '  ملاحظة  ', estimatedDurationMin: 90);

      final Map<String, Object?> body = draft.toRequestBody(version: 7);

      expect(body['version'], 7);
      expect(body['discountMinor'], 500);
      expect(body['kind'], QuoteKind.initial.value);
      expect(body['description'], 'ملاحظة');
      expect(body['estimatedDurationMin'], 90);

      final List<Object?> items = body['items']! as List<Object?>;
      final Map<String, Object?> first = items.single! as Map<String, Object?>;
      expect(first['kind'], 'LABOR');
      expect(first['description'], 'تركيب');
      expect(first['quantity'], 2.0);
      expect(first['unitPriceMinor'], 5000);
      // The line total is the server's to compute; it is never sent.
      expect(first.containsKey('lineTotalMinor'), isFalse);
    });

    test('omits an empty description and an absent duration', () {
      final QuoteDraft draft =
          const QuoteDraft(currency: 'ILS').addItem(_item(QuoteItemKind.labor)).copyWith(description: '   ');

      final Map<String, Object?> body = draft.toRequestBody(version: 1);

      expect(body.containsKey('description'), isFalse);
      expect(body.containsKey('estimatedDurationMin'), isFalse);
    });

    test('a change order carries its own kind', () {
      final Map<String, Object?> body = const QuoteDraft(currency: 'ILS')
          .addItem(_item(QuoteItemKind.parts))
          .copyWith(kind: QuoteKind.changeOrder)
          .toRequestBody(version: 3);

      expect(body['kind'], QuoteKind.changeOrder.value);
    });

    test('clearDuration removes a duration that was set earlier', () {
      final QuoteDraft withDuration =
          const QuoteDraft(currency: 'ILS').copyWith(estimatedDurationMin: 60);

      expect(withDuration.copyWith(clearDuration: true).estimatedDurationMin, isNull);
    });
  });
}
