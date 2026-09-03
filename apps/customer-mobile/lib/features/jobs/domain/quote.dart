import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/money.dart';

/// One row of a technician's quote (`QuoteItemDto`).
class QuoteItem {
  const QuoteItem({
    required this.id,
    required this.kind,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  factory QuoteItem.fromJson(JsonMap json) => QuoteItem(
        id: readStringOr(json, 'id', ''),
        kind: readStringOr(json, 'kind', 'LABOR'),
        description: readStringOr(json, 'description', ''),
        quantity: readDoubleOr(json, 'quantity', 1),
        unitPrice: readObject<Money>(json, 'unitPrice', Money.fromJson) ?? const Money.zero('ILS'),
        total: readObject<Money>(json, 'total', Money.fromJson) ?? const Money.zero('ILS'),
      );

  final String id;

  /// `LABOR`, `PARTS` or `FEE`.
  final String kind;
  final String description;
  final double quantity;
  final Money unitPrice;
  final Money total;
}

/// A quote or change order awaiting the customer's decision (`QuoteDto`).
class Quote {
  const Quote({
    required this.id,
    required this.jobId,
    required this.kind,
    required this.revision,
    required this.status,
    required this.laborCost,
    required this.partsCost,
    required this.additionalFees,
    required this.discount,
    required this.tax,
    required this.total,
    required this.items,
    this.description,
    this.estimatedDurationMin,
    this.submittedAt,
    this.decidedAt,
    this.decisionNote,
    this.supersedesQuoteId,
  });

  factory Quote.fromJson(JsonMap json) => Quote(
        id: readStringOr(json, 'id', ''),
        jobId: readStringOr(json, 'jobId', ''),
        kind: QuoteKind.fromValue(readString(json, 'kind')) ?? QuoteKind.initial,
        revision: readIntOr(json, 'revision', 1),
        status: QuoteStatus.fromValue(readString(json, 'status')) ?? QuoteStatus.submitted,
        laborCost: readObject<Money>(json, 'laborCost', Money.fromJson) ?? const Money.zero('ILS'),
        partsCost: readObject<Money>(json, 'partsCost', Money.fromJson) ?? const Money.zero('ILS'),
        additionalFees: readObject<Money>(json, 'additionalFees', Money.fromJson) ?? const Money.zero('ILS'),
        discount: readObject<Money>(json, 'discount', Money.fromJson) ?? const Money.zero('ILS'),
        tax: readObject<Money>(json, 'tax', Money.fromJson) ?? const Money.zero('ILS'),
        total: readObject<Money>(json, 'total', Money.fromJson) ?? const Money.zero('ILS'),
        items: readList<QuoteItem>(json, 'items', QuoteItem.fromJson),
        description: readString(json, 'description'),
        estimatedDurationMin: readInt(json, 'estimatedDurationMin'),
        submittedAt: readDateTime(json, 'submittedAt'),
        decidedAt: readDateTime(json, 'decidedAt'),
        decisionNote: readString(json, 'decisionNote'),
        supersedesQuoteId: readString(json, 'supersedesQuoteId'),
      );

  final String id;
  final String jobId;
  final QuoteKind kind;
  final int revision;
  final QuoteStatus status;
  final Money laborCost;
  final Money partsCost;
  final Money additionalFees;
  final Money discount;
  final Money tax;
  final Money total;
  final List<QuoteItem> items;
  final String? description;
  final int? estimatedDurationMin;
  final DateTime? submittedAt;
  final DateTime? decidedAt;
  final String? decisionNote;

  /// Set on a change order that replaces an approved quote.
  final String? supersedesQuoteId;

  bool get awaitsDecision => status == QuoteStatus.submitted;

  bool get isChangeOrder => kind == QuoteKind.changeOrder;
}
