import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';

/// Server-side pricing. The app supplies the inputs and displays the answer —
/// it never derives a price itself (spec §50).
class PricingRepository {
  const PricingRepository(this._api);

  final ApiClient _api;

  Future<FareEstimate> rideEstimate({
    required Address pickup,
    required Address destination,
    DateTime? scheduledFor,
  }) async =>
      FareEstimate.fromJson(
        await _api.postObject(
          ApiPaths.rideEstimate,
          body: <String, Object?>{
            'pickup': pickup.toJson(),
            'destination': destination.toJson(),
            if (scheduledFor != null) 'scheduledFor': toIsoUtc(scheduledFor),
          },
        ),
      );

  Future<FareEstimate> deliveryEstimate({
    required Address pickup,
    required Address destination,
    required String packageCategoryId,
    required String approximateSize,
    required JobUrgency urgency,
    double? approximateWeightKg,
    DateTime? scheduledFor,
  }) async =>
      FareEstimate.fromJson(
        await _api.postObject(
          ApiPaths.deliveryEstimate,
          body: <String, Object?>{
            'pickup': pickup.toJson(),
            'destination': destination.toJson(),
            'packageCategoryId': packageCategoryId,
            'approximateSize': approximateSize,
            'urgency': urgency.value,
            if (approximateWeightKg != null) 'approximateWeightKg': approximateWeightKg,
            if (scheduledFor != null) 'scheduledFor': toIsoUtc(scheduledFor),
          },
        ),
      );

  Future<FareEstimate> serviceEstimate({
    required Address location,
    required String categoryId,
    required JobUrgency urgency,
    String? subcategoryId,
    List<String> optionIds = const <String>[],
    DateTime? scheduledFor,
  }) async =>
      FareEstimate.fromJson(
        await _api.postObject(
          ApiPaths.serviceEstimate,
          body: <String, Object?>{
            'location': location.toJson(),
            'categoryId': categoryId,
            'urgency': urgency.value,
            'optionIds': optionIds,
            if (subcategoryId != null) 'subcategoryId': subcategoryId,
            if (scheduledFor != null) 'scheduledFor': toIsoUtc(scheduledFor),
          },
        ),
      );

  /// Previews a promo against a live estimate. The real redemption happens when
  /// the job is created; this only tells the customer what they would save.
  Future<PromoPreview> validatePromo({
    required String code,
    required String estimateId,
    PaymentMethod? paymentMethod,
  }) async =>
      PromoPreview.fromJson(
        await _api.postObject(
          ApiPaths.promoValidate,
          body: <String, Object?>{
            'code': code.trim().toUpperCase(),
            'estimateId': estimateId,
            if (paymentMethod != null) 'paymentMethod': paymentMethod.value,
          },
        ),
      );
}
