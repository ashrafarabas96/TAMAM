import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/domain/quote.dart';

/// The reasons a customer may give when cancelling (`cancelJobSchema`).
enum CancelReason {
  changedMind('CHANGED_MIND'),
  waitTooLong('WAIT_TOO_LONG'),
  wrongAddress('WRONG_ADDRESS'),
  priceTooHigh('PRICE_TOO_HIGH'),
  partnerNotMoving('PARTNER_NOT_MOVING'),
  safetyConcern('SAFETY_CONCERN'),
  duplicate('DUPLICATE'),
  other('OTHER');

  const CancelReason(this.value);

  final String value;
}

/// Which tab of "طلباتي" is being shown.
enum JobStatusGroup {
  all('all'),
  active('active'),
  completed('completed'),
  cancelled('cancelled');

  const JobStatusGroup(this.value);

  final String value;
}

/// Everything the customer app does with a job.
class JobsRepository {
  const JobsRepository(this._api);

  final ApiClient _api;

  /// Creates a job. The [idempotencyKey] is generated once per *draft*, so a
  /// manual retry after a timeout can never produce a second job.
  Future<Job> create(JsonMap body, {required String idempotencyKey}) async =>
      Job.fromJson(await _api.postObject(ApiPaths.jobs, body: body, idempotencyKey: idempotencyKey));

  Future<CursorPage<Job>> list({
    JobStatusGroup group = JobStatusGroup.all,
    String? cursor,
    int limit = 20,
  }) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.customerJobs,
      query: <String, Object?>{'statusGroup': group.value, 'cursor': cursor, 'limit': limit},
    );
    return CursorPage<Job>.fromJson(json, Job.fromJson);
  }

  Future<Job> get(String id) async => Job.fromJson(await _api.getObject(ApiPaths.job(id)));

  Future<List<JobEvent>> timeline(String id) async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.jobTimeline(id));
    return raw.map(JobEvent.fromJson).toList(growable: false);
  }

  Future<Job> cancel(String id, {required CancelReason reason, required int version, String? note}) async =>
      Job.fromJson(
        await _api.postObject(
          ApiPaths.jobCancel(id),
          body: <String, Object?>{
            'reasonCode': reason.value,
            'version': version,
            if (note != null && note.isNotEmpty) 'reasonText': note,
          },
        ),
      );

  /// Customer sign-off on completed home-service work.
  Future<Job> confirmWork(String id, {required int version, String? note}) async => Job.fromJson(
        await _api.postObject(
          ApiPaths.jobConfirmWork(id),
          body: <String, Object?>{'version': version, if (note != null && note.isNotEmpty) 'note': note},
        ),
      );

  /// Re-runs dispatch after `NO_PARTNER_AVAILABLE`.
  Future<void> retryDispatch(String id) async {
    await _api.postObject(ApiPaths.jobRetryDispatch(id));
  }

  Future<ShareLink> share(String id, {int expiresInMinutes = 180}) async {
    final JsonMap json = await _api.postObject(
      ApiPaths.jobShare(id),
      body: <String, Object?>{'expiresInMinutes': expiresInMinutes},
    );
    return ShareLink(
      url: readStringOr(json, 'url', ''),
      expiresAt: readDateTimeOr(json, 'expiresAt', DateTime.now().add(Duration(minutes: expiresInMinutes))),
    );
  }

  Future<void> stopSharing(String id) => _api.delete(ApiPaths.jobShare(id));

  /// Raises an SOS alert; operations sees it immediately.
  Future<void> sos(String id, {required GeoPoint location, String? note}) async {
    await _api.postObject(
      ApiPaths.jobSos(id),
      body: <String, Object?>{
        'location': location.toJson(),
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<JobLiveState> liveState(String id) async =>
      JobLiveState.fromRest(await _api.getObject(ApiPaths.jobLocation(id)));

  /// The partner's travelled path, for drawing the trail behind the marker.
  Future<List<GeoPoint>> path(String id) async {
    final JsonMap json = await _api.getObject(ApiPaths.jobPath(id));
    return asJsonList(json['points']).map(GeoPoint.fromJson).toList(growable: false);
  }

  Future<List<Quote>> quotes(String id) async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.jobQuotes(id));
    return raw.map(Quote.fromJson).toList(growable: false);
  }

  /// Approves or rejects the active quote. [version] guards against acting on
  /// a quote that was superseded while the sheet was open.
  Future<Job> decideQuote(
    String id, {
    required bool approve,
    required int version,
    String? note,
  }) async =>
      Job.fromJson(
        await _api.postObject(
          ApiPaths.jobQuoteDecision(id),
          body: <String, Object?>{
            'decision': approve ? 'APPROVE' : 'REJECT',
            'version': version,
            if (note != null && note.isNotEmpty) 'note': note,
          },
        ),
      );

  /// Ends an inspection-only visit: the customer pays the inspection fee and
  /// declines the work.
  Future<Job> closeInspectionOnly(String id, {required int version, String? note}) async => Job.fromJson(
        await _api.postObject(
          ApiPaths.jobCloseInspection(id),
          body: <String, Object?>{'version': version, if (note != null && note.isNotEmpty) 'note': note},
        ),
      );

  Future<JobPayment?> payment(String id) async {
    final JsonMap json = await _api.getObject(ApiPaths.jobPayment(id));
    return json.isEmpty ? null : JobPayment.fromJson(json);
  }

  Future<void> rate(String id, {required int rating, List<String> tags = const <String>[], String? comment}) async {
    await _api.postObject(
      ApiPaths.jobRating(id),
      body: <String, Object?>{
        'rating': rating,
        'tags': tags,
        if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
      },
    );
  }

  Future<JsonMap> existingRating(String id) => _api.getObject(ApiPaths.jobRating(id));

  /// The public, token-scoped view behind a shared trip link. It returns only
  /// status, stops, a first-name partner card and the ETA — never contact
  /// details or money.
  Future<Job> publicTrack(String token) async =>
      Job.fromJson(await _api.getObject(ApiPaths.publicTrack(token)));

  /// Builds a prefilled draft from a past job (`POST /customers/me/reorder`).
  /// Nothing is created: the app re-runs the estimate and asks for confirmation.
  Future<JsonMap> reorderDraft(String jobId) =>
      _api.postObject(ApiPaths.reorder, body: <String, Object?>{'jobId': jobId});
}

/// A live-trip link the customer can share.
class ShareLink {
  const ShareLink({required this.url, required this.expiresAt});

  final String url;
  final DateTime expiresAt;
}
