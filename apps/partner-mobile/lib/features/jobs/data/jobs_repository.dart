import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';

/// Which slice of history the list shows (`jobListFilterSchema.statusGroup`).
enum JobStatusGroup {
  active('active'),
  completed('completed'),
  cancelled('cancelled'),
  all('all');

  const JobStatusGroup(this.value);

  final String value;
}

/// The reasons a partner may give (`cancelJobSchema.reasonCode`, partner subset).
enum PartnerCancelReason {
  customerNoShow('CUSTOMER_NO_SHOW'),
  customerUnreachable('CUSTOMER_UNREACHABLE'),
  wrongAddress('WRONG_ADDRESS'),
  vehicleIssue('VEHICLE_ISSUE'),
  safetyConcern('SAFETY_CONCERN'),
  other('OTHER');

  const PartnerCancelReason(this.value);

  final String value;

  /// Only allowed once the server's waiting timeout has elapsed after arrival.
  bool get requiresWaitingTimeout => this == customerNoShow || this == customerUnreachable;
}

/// Proof of delivery for `POST /jobs/:id/complete` on DELIVERY jobs.
class ProofOfDelivery {
  const ProofOfDelivery({this.deliveryOtp, this.receiverName, this.photoMediaId, this.signatureMediaId});

  final String? deliveryOtp;
  final String? receiverName;
  final String? photoMediaId;
  final String? signatureMediaId;

  bool get isEmpty =>
      deliveryOtp == null && receiverName == null && photoMediaId == null && signatureMediaId == null;

  JsonMap toJson() => <String, Object?>{
        if (deliveryOtp != null) 'deliveryOtp': deliveryOtp,
        if (receiverName != null && receiverName!.isNotEmpty) 'receiverName': receiverName,
        if (photoMediaId != null) 'photoMediaId': photoMediaId,
        if (signatureMediaId != null) 'signatureMediaId': signatureMediaId,
      };
}

/// A customer→partner or partner→customer review (`ReviewDto`).
class JobRating {
  const JobRating({required this.rating, required this.tags, this.comment, this.createdAt});

  factory JobRating.fromJson(JsonMap json) => JobRating(
        rating: readIntOr(json, 'rating', 0),
        tags: readStringList(json, 'tags'),
        comment: readString(json, 'comment'),
        createdAt: readDateTime(json, 'createdAt'),
      );

  final int rating;
  final List<String> tags;
  final String? comment;
  final DateTime? createdAt;
}

/// Everything the partner does to a job, plus history.
///
/// Every transition echoes the job's `version`; a `VERSION_CONFLICT` means the
/// screen must refetch and let the partner look again before retrying.
class JobsRepository {
  const JobsRepository(this._api);

  final ApiClient _api;

  Future<CursorPage<Job>> list({
    JobStatusGroup group = JobStatusGroup.all,
    DateTime? from,
    DateTime? to,
    String? cursor,
    int limit = 20,
  }) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.partnerJobs,
      query: <String, Object?>{
        'statusGroup': group.value,
        if (from != null) 'from': toIsoUtc(from),
        if (to != null) 'to': toIsoUtc(to),
        'cursor': cursor,
        'limit': limit,
      },
    );
    return CursorPage<Job>.fromJson(json, Job.fromJson);
  }

  Future<Job> get(String id) async => Job.fromJson(await _api.getObject(ApiPaths.job(id)));

  Future<List<JobEvent>> timeline(String id) async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.jobTimeline(id));
    return raw.map(JobEvent.fromJson).toList(growable: false);
  }

  /* ------------------------------------------------------- transitions */

  Future<Job> enRoute(String id, {required int version}) =>
      _transition(ApiPaths.jobEnRoute(id), <String, Object?>{'version': version});

  Future<Job> arrive(String id, {required int version, required LocationSample location}) =>
      _transition(ApiPaths.jobArrive(id), <String, Object?>{'version': version, 'location': location.toJson()});

  Future<Job> start(
    String id, {
    required int version,
    String? tripPin,
    String? pickupOtp,
    LocationSample? location,
  }) =>
      _transition(ApiPaths.jobStart(id), <String, Object?>{
        'version': version,
        if (tripPin != null) 'tripPin': tripPin,
        if (pickupOtp != null) 'pickupOtp': pickupOtp,
        if (location != null) 'location': location.toJson(),
      });

  Future<Job> complete(
    String id, {
    required int version,
    LocationSample? location,
    ProofOfDelivery? proof,
  }) =>
      _transition(ApiPaths.jobComplete(id), <String, Object?>{
        'version': version,
        if (location != null) 'location': location.toJson(),
        if (proof != null && !proof.isEmpty) 'proofOfDelivery': proof.toJson(),
      });

  Future<Job> startWork(String id, {required int version, String? note}) =>
      _transition(ApiPaths.jobWorkStart(id), _simple(version, note));

  Future<Job> waitingForParts(String id, {required int version, String? note}) =>
      _transition(ApiPaths.jobWorkWaitingForParts(id), _simple(version, note));

  Future<Job> resumeWork(String id, {required int version, String? note}) =>
      _transition(ApiPaths.jobWorkResume(id), _simple(version, note));

  Future<Job> completeWork(String id, {required int version, LocationSample? location}) =>
      _transition(ApiPaths.jobWorkComplete(id), <String, Object?>{
        'version': version,
        if (location != null) 'location': location.toJson(),
      });

  Future<Job> cancel(
    String id, {
    required int version,
    required PartnerCancelReason reason,
    String? reasonText,
  }) =>
      _transition(ApiPaths.jobCancel(id), <String, Object?>{
        'version': version,
        'reasonCode': reason.value,
        if (reasonText != null && reasonText.trim().isNotEmpty) 'reasonText': reasonText.trim(),
      });

  /// `POST /jobs/:id/release` — hands the job back to dispatch before starting.
  Future<void> release(String id, {required String reason}) async {
    await _api.postObject(ApiPaths.jobRelease(id), body: <String, Object?>{'reason': reason.trim()});
  }

  /* ------------------------------------------------------------ rating */

  Future<JobRating> rateCustomer(String id, {required int rating, List<String> tags = const <String>[], String? comment}) async =>
      JobRating.fromJson(
        await _api.postObject(
          ApiPaths.jobRating(id),
          body: <String, Object?>{
            'rating': rating,
            'tags': tags,
            if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
          },
        ),
      );

  /// The rating the partner already gave, or `null`.
  Future<JobRating?> myRating(String id) async {
    final JsonMap json = await _api.getObject(ApiPaths.jobRating(id));
    // The endpoint returns both directions; the partner's own review is the
    // one they authored. An empty object means nothing was given yet.
    final JsonMap? given = asJsonMap(json['given']) ?? (json['rating'] is int ? json : null);
    return given == null ? null : JobRating.fromJson(given);
  }

  JsonMap _simple(int version, String? note) => <String, Object?>{
        'version': version,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      };

  Future<Job> _transition(String path, JsonMap body) async => Job.fromJson(await _api.postObject(path, body: body));
}
