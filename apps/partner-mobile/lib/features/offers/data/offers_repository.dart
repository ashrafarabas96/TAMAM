import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';

/// Pending dispatch offers and the accept/decline call.
class OffersRepository {
  const OffersRepository(this._api);

  final ApiClient _api;

  /// `GET /partners/me/offers` — the REST view of the same offers the socket
  /// pushes; polled on foreground and used when the socket is down.
  Future<List<JobOffer>> pending() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.partnerOffers);
    final DateTime now = DateTime.now();
    return raw.map((JsonMap json) => JobOffer.fromJson(json, receivedAt: now)).toList(growable: false);
  }

  /// `POST /partners/me/offers/respond` (`respondToOfferSchema`).
  ///
  /// Returns the assigned job on acceptance, `null` on decline. Failures the
  /// screen cares about: `OFFER_EXPIRED`, `JOB_ALREADY_ASSIGNED` (both 409).
  Future<Job?> respond({
    required String assignmentId,
    required bool accept,
    LocationSample? location,
  }) async {
    final JsonMap json = await _api.postObject(
      ApiPaths.partnerOffersRespond,
      body: <String, Object?>{
        'assignmentId': assignmentId,
        'accept': accept,
        if (location != null) 'location': location.toJson(),
      },
    );
    if (!accept || json['id'] == null) return null;
    return Job.fromJson(json);
  }
}
