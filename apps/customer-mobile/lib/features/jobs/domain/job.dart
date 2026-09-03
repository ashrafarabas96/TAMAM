import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/features/jobs/domain/quote.dart';

/// One pickup / drop-off / service location on a job (`JobStopDto`).
class JobStop {
  const JobStop({
    required this.id,
    required this.sequence,
    required this.kind,
    required this.address,
    this.contactName,
    this.contactPhone,
    this.notes,
    this.arrivedAt,
    this.completedAt,
  });

  factory JobStop.fromJson(JsonMap json) => JobStop(
        id: readStringOr(json, 'id', ''),
        sequence: readIntOr(json, 'sequence', 0),
        kind: JobStopKind.fromValue(readString(json, 'kind')) ?? JobStopKind.pickup,
        address: readObject<Address>(json, 'address', Address.fromJson) ??
            const Address(lat: 0, lng: 0, formatted: ''),
        contactName: readString(json, 'contactName'),
        contactPhone: readString(json, 'contactPhone'),
        notes: readString(json, 'notes'),
        arrivedAt: readDateTime(json, 'arrivedAt'),
        completedAt: readDateTime(json, 'completedAt'),
      );

  final String id;
  final int sequence;
  final JobStopKind kind;
  final Address address;
  final String? contactName;
  final String? contactPhone;
  final String? notes;
  final DateTime? arrivedAt;
  final DateTime? completedAt;
}

/// Vehicle details on the partner card.
class PartnerVehicle {
  const PartnerVehicle({
    required this.brand,
    required this.model,
    required this.color,
    required this.plate,
    required this.typeName,
  });

  factory PartnerVehicle.fromJson(JsonMap json) => PartnerVehicle(
        brand: readStringOr(json, 'brand', ''),
        model: readStringOr(json, 'model', ''),
        color: readStringOr(json, 'color', ''),
        plate: readStringOr(json, 'plate', ''),
        typeName: LocalizedText.required(json, 'typeName'),
      );

  final String brand;
  final String model;
  final String color;
  final String plate;
  final LocalizedText typeName;

  String get title => '$brand $model'.trim();
}

/// The assigned partner as the customer sees them (`JobPartnerCardDto`).
class JobPartnerCard {
  const JobPartnerCard({
    required this.id,
    required this.fullName,
    required this.rating,
    required this.ratingCount,
    this.profileImageUrl,
    this.maskedPhone,
    this.vehicle,
    this.location,
  });

  factory JobPartnerCard.fromJson(JsonMap json) => JobPartnerCard(
        id: readStringOr(json, 'id', ''),
        fullName: readStringOr(json, 'fullName', ''),
        rating: readDoubleOr(json, 'rating', 0),
        ratingCount: readIntOr(json, 'ratingCount', 0),
        profileImageUrl: readString(json, 'profileImageUrl'),
        maskedPhone: readString(json, 'maskedPhone'),
        vehicle: readObject<PartnerVehicle>(json, 'vehicle', PartnerVehicle.fromJson),
        location: readObject<GeoPoint>(json, 'location', GeoPoint.fromJson),
      );

  final String id;
  final String fullName;
  final double rating;
  final int ratingCount;
  final String? profileImageUrl;

  /// Proxy number when phone masking is on; the raw number otherwise.
  final String? maskedPhone;
  final PartnerVehicle? vehicle;
  final GeoPoint? location;

  bool get canCall => maskedPhone != null && maskedPhone!.isNotEmpty;
}

/// Delivery-specific fields (`DeliveryDetailsDto`).
class DeliveryDetails {
  const DeliveryDetails({
    required this.packageCategoryId,
    required this.packageCategoryName,
    required this.approximateSize,
    required this.senderName,
    required this.senderPhone,
    required this.recipientName,
    required this.recipientPhone,
    this.approximateWeightKg,
    this.deliveryNotes,
    this.proofOfDeliveryPhotoUrl,
    this.proofReceiverName,
  });

  factory DeliveryDetails.fromJson(JsonMap json) {
    final JsonMap? proof = asJsonMap(json['proof']);
    return DeliveryDetails(
      packageCategoryId: readStringOr(json, 'packageCategoryId', ''),
      packageCategoryName: LocalizedText.required(json, 'packageCategoryName'),
      approximateSize: readStringOr(json, 'approximateSize', 'SMALL'),
      senderName: readStringOr(json, 'senderName', ''),
      senderPhone: readStringOr(json, 'senderPhone', ''),
      recipientName: readStringOr(json, 'recipientName', ''),
      recipientPhone: readStringOr(json, 'recipientPhone', ''),
      approximateWeightKg: readDouble(json, 'approximateWeightKg'),
      deliveryNotes: readString(json, 'deliveryNotes'),
      proofOfDeliveryPhotoUrl: proof == null ? null : readString(proof, 'photoUrl'),
      proofReceiverName: proof == null ? null : readString(proof, 'receiverName'),
    );
  }

  final String packageCategoryId;
  final LocalizedText packageCategoryName;

  /// `SMALL` | `MEDIUM` | `LARGE` | `XL`.
  final String approximateSize;
  final String senderName;
  final String senderPhone;
  final String recipientName;
  final String recipientPhone;
  final double? approximateWeightKg;
  final String? deliveryNotes;
  final String? proofOfDeliveryPhotoUrl;
  final String? proofReceiverName;
}

/// A timeline entry (`JobEventDto`).
class JobEvent {
  const JobEvent({
    required this.id,
    required this.type,
    required this.actorType,
    required this.createdAt,
    this.fromStatus,
    this.toStatus,
    this.data,
  });

  factory JobEvent.fromJson(JsonMap json) => JobEvent(
        id: readStringOr(json, 'id', ''),
        type: readStringOr(json, 'type', ''),
        actorType: JobActorType.fromValue(readString(json, 'actorType')) ?? JobActorType.system,
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        fromStatus: JobStatus.fromValue(readString(json, 'fromStatus')),
        toStatus: JobStatus.fromValue(readString(json, 'toStatus')),
        data: asJsonMap(json['data']),
      );

  final String id;
  final String type;
  final JobActorType actorType;
  final DateTime createdAt;
  final JobStatus? fromStatus;
  final JobStatus? toStatus;
  final JsonMap? data;
}

/// The full job as the customer app sees it (`JobDto`).
///
/// `version` is load-bearing: every mutating call (cancel, quote decision,
/// confirm work) sends it back so the server can reject a stale action.
class Job {
  const Job({
    required this.id,
    required this.number,
    required this.type,
    required this.status,
    required this.version,
    required this.customerId,
    required this.zoneId,
    required this.scheduling,
    required this.urgency,
    required this.currency,
    required this.paymentMethod,
    required this.stops,
    required this.breakdown,
    required this.dynamicFields,
    required this.mediaUrls,
    required this.tripPinRequired,
    required this.pickupOtpRequired,
    required this.deliveryOtpRequired,
    required this.createdAt,
    required this.updatedAt,
    this.partnerId,
    this.categoryId,
    this.subcategoryId,
    this.vehicleTypeId,
    this.scheduledFor,
    this.estimatedTotal,
    this.finalTotal,
    this.distanceMeters,
    this.durationSeconds,
    this.etaToPickupSeconds,
    this.etaToDestinationSeconds,
    this.description,
    this.tripPin,
    this.deliveryOtp,
    this.delivery,
    this.partner,
    this.activeQuote,
    this.promoCode,
    this.cancellationReason,
    this.cancelledBy,
    this.cancellationFee,
    this.completedAt,
    this.events = const <JobEvent>[],
  });

  factory Job.fromJson(JsonMap json) => Job(
        id: readStringOr(json, 'id', ''),
        number: readStringOr(json, 'number', ''),
        type: JobType.fromValue(readString(json, 'type')) ?? JobType.ride,
        status: JobStatus.fromValue(readString(json, 'status')) ?? JobStatus.requested,
        version: readIntOr(json, 'version', 0),
        customerId: readStringOr(json, 'customerId', ''),
        zoneId: readStringOr(json, 'zoneId', ''),
        scheduling: SchedulingMode.fromValue(readString(json, 'scheduling')) ?? SchedulingMode.now,
        urgency: JobUrgency.fromValue(readString(json, 'urgency')) ?? JobUrgency.standard,
        currency: readStringOr(json, 'currency', 'ILS'),
        paymentMethod: PaymentMethod.fromValue(readString(json, 'paymentMethod')) ?? PaymentMethod.cash,
        stops: readList<JobStop>(json, 'stops', JobStop.fromJson)
          ..sort((JobStop a, JobStop b) => a.sequence.compareTo(b.sequence)),
        breakdown: readList<FareBreakdownLine>(json, 'breakdown', FareBreakdownLine.fromJson),
        dynamicFields: readDynamicMap(json, 'dynamicFields'),
        mediaUrls: readStringList(json, 'mediaUrls'),
        tripPinRequired: readBoolOr(json, 'tripPinRequired', false),
        pickupOtpRequired: readBoolOr(json, 'pickupOtpRequired', false),
        deliveryOtpRequired: readBoolOr(json, 'deliveryOtpRequired', false),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        updatedAt: readDateTimeOr(json, 'updatedAt', DateTime.now()),
        partnerId: readString(json, 'partnerId'),
        categoryId: readString(json, 'categoryId'),
        subcategoryId: readString(json, 'subcategoryId'),
        vehicleTypeId: readString(json, 'vehicleTypeId'),
        scheduledFor: readDateTime(json, 'scheduledFor'),
        estimatedTotal: readObject<Money>(json, 'estimatedTotal', Money.fromJson),
        finalTotal: readObject<Money>(json, 'finalTotal', Money.fromJson),
        distanceMeters: readInt(json, 'distanceMeters'),
        durationSeconds: readInt(json, 'durationSeconds'),
        etaToPickupSeconds: readInt(json, 'etaToPickupSeconds'),
        etaToDestinationSeconds: readInt(json, 'etaToDestinationSeconds'),
        description: readString(json, 'description'),
        tripPin: readString(json, 'tripPin'),
        deliveryOtp: readString(json, 'deliveryOtp'),
        delivery: readObject<DeliveryDetails>(json, 'delivery', DeliveryDetails.fromJson),
        partner: readObject<JobPartnerCard>(json, 'partner', JobPartnerCard.fromJson),
        activeQuote: readObject<Quote>(json, 'activeQuote', Quote.fromJson),
        promoCode: readString(json, 'promoCode'),
        cancellationReason: readString(json, 'cancellationReason'),
        cancelledBy: JobActorType.fromValue(readString(json, 'cancelledBy')),
        cancellationFee: readObject<Money>(json, 'cancellationFee', Money.fromJson),
        completedAt: readDateTime(json, 'completedAt'),
        events: readList<JobEvent>(json, 'events', JobEvent.fromJson),
      );

  final String id;

  /// Human-readable reference, e.g. `TM-26-000123`.
  final String number;
  final JobType type;
  final JobStatus status;

  /// Optimistic-concurrency version; echoed on every mutating request.
  final int version;
  final String customerId;
  final String zoneId;
  final SchedulingMode scheduling;
  final JobUrgency urgency;
  final String currency;
  final PaymentMethod paymentMethod;
  final List<JobStop> stops;
  final List<FareBreakdownLine> breakdown;
  final JsonMap dynamicFields;
  final List<String> mediaUrls;
  final bool tripPinRequired;
  final bool pickupOtpRequired;
  final bool deliveryOtpRequired;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? partnerId;
  final String? categoryId;
  final String? subcategoryId;
  final String? vehicleTypeId;
  final DateTime? scheduledFor;
  final Money? estimatedTotal;
  final Money? finalTotal;
  final int? distanceMeters;
  final int? durationSeconds;
  final int? etaToPickupSeconds;
  final int? etaToDestinationSeconds;
  final String? description;

  /// Shown large on the tracking screen so the driver can verify the rider.
  final String? tripPin;
  final String? deliveryOtp;
  final DeliveryDetails? delivery;
  final JobPartnerCard? partner;
  final Quote? activeQuote;
  final String? promoCode;
  final String? cancellationReason;
  final JobActorType? cancelledBy;
  final Money? cancellationFee;
  final DateTime? completedAt;
  final List<JobEvent> events;

  JobStop? get pickup => _stop(JobStopKind.pickup) ?? _stop(JobStopKind.serviceLocation);
  JobStop? get destination => _stop(JobStopKind.dropoff);

  /// The single location a home-service job happens at.
  JobStop? get serviceLocation => _stop(JobStopKind.serviceLocation);

  Money? get displayTotal => finalTotal ?? estimatedTotal;

  bool get isActive => !isTerminal;

  bool get isTerminal =>
      status == JobStatus.completed ||
      status == JobStatus.cancelled ||
      status == JobStatus.noPartnerAvailable;

  bool get isCancelled => status == JobStatus.cancelled;

  bool get isSearching => status == JobStatus.requested || status == JobStatus.searching;

  bool get hasPartner => partner != null;

  /// True once a partner is on the way or working — the point at which the map
  /// and live ETA become useful.
  bool get isLive =>
      status == JobStatus.assigned ||
      status == JobStatus.partnerEnRoute ||
      status == JobStatus.partnerArrived ||
      status == JobStatus.waitingCustomer ||
      status == JobStatus.inProgress;

  /// Home-service jobs pause here until the customer decides on a quote.
  bool get awaitsQuoteDecision =>
      status == JobStatus.quoteSubmitted && activeQuote != null && activeQuote!.awaitsDecision;

  bool get awaitsWorkConfirmation => status == JobStatus.workCompleted;

  bool get canCancel =>
      !isTerminal &&
      status != JobStatus.workCompleted &&
      status != JobStatus.customerConfirmed;

  bool get canRetryDispatch => status == JobStatus.noPartnerAvailable;

  bool get canRate => status == JobStatus.completed;

  bool get isHomeService => type == JobType.homeService;

  JobStop? _stop(JobStopKind kind) {
    for (final JobStop stop in stops) {
      if (stop.kind == kind) return stop;
    }
    return null;
  }
}

/// A single payment record for a job (`PaymentDto`).
class JobPayment {
  const JobPayment({
    required this.id,
    required this.jobId,
    required this.method,
    required this.status,
    required this.amount,
    required this.capturedAmount,
    required this.refundedAmount,
    required this.createdAt,
    this.failureReason,
  });

  factory JobPayment.fromJson(JsonMap json) => JobPayment(
        id: readStringOr(json, 'id', ''),
        jobId: readStringOr(json, 'jobId', ''),
        method: PaymentMethod.fromValue(readString(json, 'method')) ?? PaymentMethod.cash,
        status: PaymentStatus.fromValue(readString(json, 'status')) ?? PaymentStatus.pending,
        amount: readObject<Money>(json, 'amount', Money.fromJson) ?? const Money.zero('ILS'),
        capturedAmount: readObject<Money>(json, 'capturedAmount', Money.fromJson) ?? const Money.zero('ILS'),
        refundedAmount: readObject<Money>(json, 'refundedAmount', Money.fromJson) ?? const Money.zero('ILS'),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        failureReason: readString(json, 'failureReason'),
      );

  final String id;
  final String jobId;
  final PaymentMethod method;
  final PaymentStatus status;
  final Money amount;
  final Money capturedAmount;
  final Money refundedAmount;
  final DateTime createdAt;
  final String? failureReason;

  bool get isSettled => status == PaymentStatus.captured;
  bool get hasFailed => status == PaymentStatus.failed;
}

/// Live position + ETA from `GET /jobs/:id/location` or the tracking socket.
class JobLiveState {
  const JobLiveState({
    required this.jobId,
    this.status,
    this.location,
    this.heading,
    this.etaToPickupSeconds,
    this.etaToDestinationSeconds,
    this.updatedAt,
  });

  factory JobLiveState.fromRest(JsonMap json) {
    final JsonMap? location = asJsonMap(json['location']);
    return JobLiveState(
      jobId: readStringOr(json, 'jobId', ''),
      status: JobStatus.fromValue(readString(json, 'status')),
      location: location == null ? null : GeoPoint.fromJson(location),
      heading: location == null ? null : readDouble(location, 'heading'),
      etaToPickupSeconds: readInt(json, 'etaToPickupSeconds'),
      etaToDestinationSeconds: readInt(json, 'etaToDestinationSeconds'),
      updatedAt: location == null ? null : readDateTime(location, 'timestamp'),
    );
  }

  /// `job:location` carries the coordinates at the top level.
  factory JobLiveState.fromLocationEvent(JsonMap json) => JobLiveState(
        jobId: readStringOr(json, 'jobId', ''),
        location: GeoPoint(lat: readDoubleOr(json, 'lat', 0), lng: readDoubleOr(json, 'lng', 0)),
        heading: readDouble(json, 'heading'),
        updatedAt: readDateTime(json, 'timestamp'),
      );

  final String jobId;
  final JobStatus? status;
  final GeoPoint? location;
  final double? heading;
  final int? etaToPickupSeconds;
  final int? etaToDestinationSeconds;
  final DateTime? updatedAt;

  /// Merges a partial update (a socket event) onto the current state.
  JobLiveState merge(JobLiveState next) => JobLiveState(
        jobId: next.jobId.isEmpty ? jobId : next.jobId,
        status: next.status ?? status,
        location: next.location ?? location,
        heading: next.heading ?? heading,
        etaToPickupSeconds: next.etaToPickupSeconds ?? etaToPickupSeconds,
        etaToDestinationSeconds: next.etaToDestinationSeconds ?? etaToDestinationSeconds,
        updatedAt: next.updatedAt ?? updatedAt,
      );
}
