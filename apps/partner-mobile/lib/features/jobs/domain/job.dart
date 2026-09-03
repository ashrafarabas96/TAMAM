import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/localized_text.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';

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

  /// BASE_FARE, DISTANCE, COMMISSION, PROMO, TAX, INSPECTION_FEE, …
  final String code;
  final LocalizedText label;
  final Money amount;

  /// Deductions are drawn in red with a minus sign on the earnings breakdown.
  bool get isDeduction => amount.isNegative || code == 'COMMISSION' || code == 'CANCELLATION_FEE';
}

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

  GeoPoint get point => address.point;
}

/// The customer as the partner sees them (`JobCustomerCardDto`).
class JobCustomerCard {
  const JobCustomerCard({
    required this.id,
    required this.fullName,
    required this.rating,
    this.profileImageUrl,
    this.maskedPhone,
  });

  factory JobCustomerCard.fromJson(JsonMap json) => JobCustomerCard(
        id: readStringOr(json, 'id', ''),
        fullName: readStringOr(json, 'fullName', ''),
        rating: readDoubleOr(json, 'rating', 0),
        profileImageUrl: readString(json, 'profileImageUrl'),
        maskedPhone: readString(json, 'maskedPhone'),
      );

  final String id;
  final String fullName;
  final double rating;
  final String? profileImageUrl;

  /// Proxy number when phone masking is on; the raw number otherwise. The real
  /// customer number is never exposed to the app.
  final String? maskedPhone;

  bool get canCall => maskedPhone != null && maskedPhone!.isNotEmpty;

  String get initials {
    final List<String> parts =
        fullName.trim().split(RegExp(r'\s+')).where((String p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '#';
    if (parts.length == 1) return parts.first.substring(0, 1);
    return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}';
  }
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
    this.proofPhotoUrl,
    this.proofReceiverName,
    this.proofOtpVerified = false,
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
      proofPhotoUrl: proof == null ? null : readString(proof, 'photoUrl'),
      proofReceiverName: proof == null ? null : readString(proof, 'receiverName'),
      proofOtpVerified: proof != null && readBoolOr(proof, 'otpVerified', false),
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
  final String? proofPhotoUrl;
  final String? proofReceiverName;
  final bool proofOtpVerified;

  bool get hasProof => proofPhotoUrl != null || proofReceiverName != null || proofOtpVerified;
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

/// The job as the partner app sees it (`JobDto`).
///
/// `version` is load-bearing: every transition (en-route, arrive, start,
/// complete, cancel, quote) sends it back so the server can reject a stale
/// action with `VERSION_CONFLICT`.
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
    this.partnerEarnings,
    this.distanceMeters,
    this.durationSeconds,
    this.etaToPickupSeconds,
    this.etaToDestinationSeconds,
    this.description,
    this.routePolyline,
    this.delivery,
    this.customer,
    this.activeQuote,
    this.cancellationReason,
    this.cancelledBy,
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
        partnerEarnings: readObject<Money>(json, 'partnerEarnings', Money.fromJson),
        distanceMeters: readInt(json, 'distanceMeters'),
        durationSeconds: readInt(json, 'durationSeconds'),
        etaToPickupSeconds: readInt(json, 'etaToPickupSeconds'),
        etaToDestinationSeconds: readInt(json, 'etaToDestinationSeconds'),
        description: readString(json, 'description'),
        routePolyline: readString(json, 'routePolyline'),
        delivery: readObject<DeliveryDetails>(json, 'delivery', DeliveryDetails.fromJson),
        customer: readObject<JobCustomerCard>(json, 'customer', JobCustomerCard.fromJson),
        activeQuote: readObject<Quote>(json, 'activeQuote', Quote.fromJson),
        cancellationReason: readString(json, 'cancellationReason'),
        cancelledBy: JobActorType.fromValue(readString(json, 'cancelledBy')),
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

  /// The partner's net share, when the server exposes it on the job.
  final Money? partnerEarnings;
  final int? distanceMeters;
  final int? durationSeconds;
  final int? etaToPickupSeconds;
  final int? etaToDestinationSeconds;
  final String? description;

  /// Encoded polyline for the planned route, when the server sends one.
  final String? routePolyline;
  final DeliveryDetails? delivery;
  final JobCustomerCard? customer;
  final Quote? activeQuote;
  final String? cancellationReason;
  final JobActorType? cancelledBy;
  final DateTime? completedAt;
  final List<JobEvent> events;

  JobStop? get pickup => _stop(JobStopKind.pickup) ?? _stop(JobStopKind.serviceLocation);
  JobStop? get destination => _stop(JobStopKind.dropoff);
  JobStop? get serviceLocation => _stop(JobStopKind.serviceLocation);

  /// Where the partner has to be right now: the pickup until they arrive, the
  /// destination afterwards.
  JobStop? get currentTarget => hasStarted ? (destination ?? pickup) : pickup;

  Money? get displayTotal => finalTotal ?? estimatedTotal;

  bool get isRide => type == JobType.ride;
  bool get isDelivery => type == JobType.delivery;
  bool get isHomeService => type == JobType.homeService;

  bool get isTerminal =>
      status == JobStatus.completed ||
      status == JobStatus.cancelled ||
      status == JobStatus.noPartnerAvailable;

  bool get isCancelled => status == JobStatus.cancelled;

  /// The job occupies the partner's shift and must show the persistent card.
  bool get isActiveForPartner => !isTerminal && status != JobStatus.customerConfirmed;

  bool get hasArrived =>
      status != JobStatus.assigned && status != JobStatus.partnerEnRoute;

  /// Work is under way: the trip started, or the technician is on the job.
  bool get hasStarted =>
      status == JobStatus.inProgress ||
      status == JobStatus.inspectionStarted ||
      status == JobStatus.quoteRequired ||
      status == JobStatus.quoteSubmitted ||
      status == JobStatus.quoteApproved ||
      status == JobStatus.workStarted ||
      status == JobStatus.waitingForParts ||
      status == JobStatus.workCompleted;

  /// The partner may still hand the job back to dispatch (before starting).
  bool get canRelease =>
      status == JobStatus.assigned ||
      status == JobStatus.partnerEnRoute ||
      status == JobStatus.partnerArrived ||
      status == JobStatus.waitingCustomer;

  bool get canCancel => !isTerminal && status != JobStatus.workCompleted;

  /// The home-service flow is waiting for this partner to price the work.
  bool get needsQuote => status == JobStatus.quoteRequired || status == JobStatus.quoteRejected;

  bool get awaitsQuoteDecision => status == JobStatus.quoteSubmitted;

  /// Everything is done on the partner's side; the customer confirms next.
  bool get awaitsCustomerConfirmation => status == JobStatus.workCompleted;

  bool get canRateCustomer => status == JobStatus.completed;

  /// The code the partner must type to start a ride or collect a package.
  /// The plain value belongs to the customer, so the partner only learns
  /// whether one is required.
  bool get requiresStartCode => isRide ? tripPinRequired : pickupOtpRequired;

  JobStop? _stop(JobStopKind kind) {
    for (final JobStop stop in stops) {
      if (stop.kind == kind) return stop;
    }
    return null;
  }
}
