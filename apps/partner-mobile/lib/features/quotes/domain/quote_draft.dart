import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';

/// One line the partner is composing, held in minor units end-to-end.
///
/// `quantity` is a decimal (2.5 hours of labour, 1.5 m of pipe) exactly as
/// `quoteItemSchema` allows; the unit price is always an integer of minor units
/// so no floating-point money ever reaches the wire.
class QuoteDraftItem {
  const QuoteDraftItem({
    required this.kind,
    required this.description,
    required this.quantity,
    required this.unitPriceMinor,
  });

  final QuoteItemKind kind;
  final String description;
  final double quantity;
  final int unitPriceMinor;

  /// Rounded the same way the server rounds a line total (half-up on the minor
  /// unit), so the preview and the final quote agree.
  int get lineTotalMinor => (quantity * unitPriceMinor).round();

  bool get isComplete => description.trim().length >= 2 && quantity > 0 && unitPriceMinor >= 0;

  QuoteDraftItem copyWith({
    QuoteItemKind? kind,
    String? description,
    double? quantity,
    int? unitPriceMinor,
  }) =>
      QuoteDraftItem(
        kind: kind ?? this.kind,
        description: description ?? this.description,
        quantity: quantity ?? this.quantity,
        unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
      );

  JsonMap toJson() => <String, Object?>{
        'kind': kind.value,
        'description': description.trim(),
        'quantity': quantity,
        'unitPriceMinor': unitPriceMinor,
      };
}

/// The quote being built on the quote-builder screen.
///
/// The totals here are a **preview only**: the server recomputes labour, parts,
/// fees, tax and the final total from the same items when the quote is
/// submitted, and its numbers are the ones the customer sees. The preview
/// exists so the partner can see the effect of a line as they type.
class QuoteDraft {
  const QuoteDraft({
    required this.currency,
    this.items = const <QuoteDraftItem>[],
    this.discountMinor = 0,
    this.description = '',
    this.estimatedDurationMin,
    this.kind = QuoteKind.initial,
  });

  /// The job's currency; every line inherits it.
  final String currency;
  final List<QuoteDraftItem> items;
  final int discountMinor;
  final String description;
  final int? estimatedDurationMin;
  final QuoteKind kind;

  static const int maxItems = 50;

  int get laborMinor => _sumOf(QuoteItemKind.labor);
  int get partsMinor => _sumOf(QuoteItemKind.parts);
  int get feesMinor => _sumOf(QuoteItemKind.fee);

  int get subtotalMinor => laborMinor + partsMinor + feesMinor;

  /// Never negative: a discount larger than the subtotal zeroes the quote
  /// rather than turning it into a payout.
  int get previewTotalMinor {
    final int total = subtotalMinor - discountMinor;
    return total < 0 ? 0 : total;
  }

  Money get labor => Money(amount: laborMinor, currency: currency);
  Money get parts => Money(amount: partsMinor, currency: currency);
  Money get fees => Money(amount: feesMinor, currency: currency);
  Money get discount => Money(amount: discountMinor, currency: currency);
  Money get previewTotal => Money(amount: previewTotalMinor, currency: currency);

  /// The discount may not exceed what is being charged.
  bool get discountExceedsSubtotal => discountMinor > subtotalMinor;

  bool get canSubmit =>
      items.isNotEmpty &&
      items.length <= maxItems &&
      items.every((QuoteDraftItem item) => item.isComplete) &&
      !discountExceedsSubtotal;

  QuoteDraft copyWith({
    List<QuoteDraftItem>? items,
    int? discountMinor,
    String? description,
    int? estimatedDurationMin,
    QuoteKind? kind,
    bool clearDuration = false,
  }) =>
      QuoteDraft(
        currency: currency,
        items: items ?? this.items,
        discountMinor: discountMinor ?? this.discountMinor,
        description: description ?? this.description,
        estimatedDurationMin: clearDuration ? null : (estimatedDurationMin ?? this.estimatedDurationMin),
        kind: kind ?? this.kind,
      );

  QuoteDraft addItem(QuoteDraftItem item) =>
      items.length >= maxItems ? this : copyWith(items: <QuoteDraftItem>[...items, item]);

  QuoteDraft replaceItem(int index, QuoteDraftItem item) {
    if (index < 0 || index >= items.length) return this;
    final List<QuoteDraftItem> next = List<QuoteDraftItem>.of(items)..[index] = item;
    return copyWith(items: next);
  }

  QuoteDraft removeItem(int index) {
    if (index < 0 || index >= items.length) return this;
    final List<QuoteDraftItem> next = List<QuoteDraftItem>.of(items)..removeAt(index);
    return copyWith(items: next);
  }

  /// The body of `POST /jobs/:id/quotes` (`submitQuoteSchema`).
  JsonMap toRequestBody({required int version}) => <String, Object?>{
        'items': items.map((QuoteDraftItem item) => item.toJson()).toList(growable: false),
        'discountMinor': discountMinor,
        if (description.trim().isNotEmpty) 'description': description.trim(),
        if (estimatedDurationMin != null) 'estimatedDurationMin': estimatedDurationMin,
        'kind': kind.value,
        'version': version,
      };

  int _sumOf(QuoteItemKind kind) {
    int total = 0;
    for (final QuoteDraftItem item in items) {
      if (item.kind == kind) total += item.lineTotalMinor;
    }
    return total;
  }
}
