import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/models/money.dart';

/// One line of a price breakdown (`FareBreakdownLine`).
///
/// The label is server-provided and already localised, because only the server
/// knows which rules produced the line.
class FareBreakdownLine {
  const FareBreakdownLine({required this.code, required this.label, required this.amount});

  factory FareBreakdownLine.fromJson(JsonMap json) => FareBreakdownLine(
        code: readStringOr(json, 'code', ''),
        label: LocalizedText.required(json, 'label'),
        amount: readObject<Money>(json, 'amount', Money.fromJson) ?? const Money.zero('ILS'),
      );

  /// BASE_FARE, DISTANCE, PROMO, TAX, INSPECTION_FEE, …
  final String code;
  final LocalizedText label;
  final Money amount;

  /// Discounts and promos are drawn in green with a minus sign.
  bool get isCredit => amount.isNegative || code == 'DISCOUNT' || code == 'PROMO';
}

/// One choice inside an estimate — a vehicle class for rides, the category for
/// services (`FareOptionDto`).
class FareOption {
  const FareOption({
    required this.name,
    required this.total,
    required this.breakdown,
    required this.surgeMultiplier,
    required this.pricingSnapshotId,
    this.vehicleTypeId,
    this.categoryId,
    this.iconUrl,
    this.seats,
    this.etaToPickupSeconds,
  });

  factory FareOption.fromJson(JsonMap json) => FareOption(
        name: LocalizedText.required(json, 'name'),
        total: readObject<Money>(json, 'total', Money.fromJson) ?? const Money.zero('ILS'),
        breakdown: readList<FareBreakdownLine>(json, 'breakdown', FareBreakdownLine.fromJson),
        surgeMultiplier: readDoubleOr(json, 'surgeMultiplier', 1),
        pricingSnapshotId: readStringOr(json, 'pricingSnapshotId', ''),
        vehicleTypeId: readString(json, 'vehicleTypeId'),
        categoryId: readString(json, 'categoryId'),
        iconUrl: readString(json, 'iconUrl'),
        seats: readInt(json, 'seats'),
        etaToPickupSeconds: readInt(json, 'etaToPickupSeconds'),
      );

  final LocalizedText name;
  final Money total;
  final List<FareBreakdownLine> breakdown;
  final double surgeMultiplier;
  final String pricingSnapshotId;
  final String? vehicleTypeId;
  final String? categoryId;
  final String? iconUrl;
  final int? seats;
  final int? etaToPickupSeconds;

  bool get hasSurge => surgeMultiplier > 1.001;
}

/// A short-lived quote from `POST /estimates/*` (`FareEstimateDto`).
///
/// The app never recomputes any of this; it selects an option and sends the
/// `estimateId` back when creating the job.
class FareEstimate {
  const FareEstimate({
    required this.estimateId,
    required this.jobType,
    required this.currency,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.options,
    required this.expiresAt,
    this.routePolyline,
  });

  factory FareEstimate.fromJson(JsonMap json) => FareEstimate(
        estimateId: readStringOr(json, 'estimateId', ''),
        jobType: JobType.fromValue(readString(json, 'jobType')) ?? JobType.ride,
        currency: readStringOr(json, 'currency', 'ILS'),
        distanceMeters: readIntOr(json, 'distanceMeters', 0),
        durationSeconds: readIntOr(json, 'durationSeconds', 0),
        options: readList<FareOption>(json, 'options', FareOption.fromJson),
        expiresAt: readDateTimeOr(json, 'expiresAt', DateTime.now().add(const Duration(minutes: 3))),
        routePolyline: readString(json, 'routePolyline'),
      );

  final String estimateId;
  final JobType jobType;
  final String currency;
  final int distanceMeters;
  final int durationSeconds;
  final List<FareOption> options;
  final DateTime expiresAt;
  final String? routePolyline;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  Duration get timeToExpiry {
    final Duration remaining = expiresAt.difference(DateTime.now());
    return remaining.isNegative ? Duration.zero : remaining;
  }
}

/// The preview returned by `POST /promos/validate`.
class PromoPreview {
  const PromoPreview({
    required this.promoCodeId,
    required this.code,
    required this.currency,
    required this.subtotal,
    required this.discount,
    required this.total,
  });

  factory PromoPreview.fromJson(JsonMap json) => PromoPreview(
        promoCodeId: readStringOr(json, 'promoCodeId', ''),
        code: readStringOr(json, 'code', ''),
        currency: readStringOr(json, 'currency', 'ILS'),
        subtotal: readObject<Money>(json, 'subtotal', Money.fromJson) ?? const Money.zero('ILS'),
        discount: readObject<Money>(json, 'discount', Money.fromJson) ?? const Money.zero('ILS'),
        total: readObject<Money>(json, 'total', Money.fromJson) ?? const Money.zero('ILS'),
      );

  final String promoCodeId;
  final String code;
  final String currency;
  final Money subtotal;
  final Money discount;
  final Money total;

  bool get savesMoney => discount.amount > 0;
}
