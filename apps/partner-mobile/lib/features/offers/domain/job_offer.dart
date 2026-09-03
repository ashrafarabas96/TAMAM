import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';

/// A dispatch offer (`JobOfferDto`) — a job the partner may accept before
/// [expiresAt]. The customer card is deliberately absent until acceptance.
class JobOffer {
  const JobOffer({
    required this.assignmentId,
    required this.job,
    required this.wave,
    required this.expiresAt,
    required this.distanceToPickupMeters,
    required this.etaToPickupSeconds,
    required this.estimatedEarnings,
    required this.receivedAt,
  });

  factory JobOffer.fromJson(JsonMap json, {DateTime? receivedAt}) => JobOffer(
        assignmentId: readStringOr(json, 'assignmentId', ''),
        job: readObject<Job>(json, 'job', Job.fromJson) ?? Job.fromJson(const <String, Object?>{}),
        wave: readIntOr(json, 'wave', 1),
        expiresAt: readDateTimeOr(json, 'expiresAt', DateTime.now().add(const Duration(seconds: 20))),
        distanceToPickupMeters: readIntOr(json, 'distanceToPickupMeters', 0),
        etaToPickupSeconds: readIntOr(json, 'etaToPickupSeconds', 0),
        estimatedEarnings: readObject<Money>(json, 'estimatedEarnings', Money.fromJson) ?? const Money.zero('ILS'),
        receivedAt: receivedAt ?? DateTime.now(),
      );

  final String assignmentId;
  final Job job;
  final int wave;
  final DateTime expiresAt;
  final int distanceToPickupMeters;
  final int etaToPickupSeconds;

  /// Bold yellow on the sheet: the number the partner decides on.
  final Money estimatedEarnings;

  /// When this device first saw the offer — the countdown ring's full window.
  final DateTime receivedAt;

  bool isExpired([DateTime? now]) => !(now ?? DateTime.now()).isBefore(expiresAt);
}
