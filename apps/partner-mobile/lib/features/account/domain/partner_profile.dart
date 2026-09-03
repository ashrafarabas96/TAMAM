import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';

/// One uploaded document with its review outcome (`PartnerDocumentDto`).
class PartnerDocument {
  const PartnerDocument({
    required this.id,
    required this.type,
    required this.fileUrl,
    required this.status,
    required this.createdAt,
    this.number,
    this.issuedAt,
    this.expiresAt,
    this.verifiedAt,
    this.rejectionReason,
  });

  factory PartnerDocument.fromJson(JsonMap json) => PartnerDocument(
        id: readStringOr(json, 'id', ''),
        type: DocumentType.fromValue(readString(json, 'type')) ?? DocumentType.id,
        fileUrl: readStringOr(json, 'fileUrl', ''),
        status: DocumentStatus.fromValue(readString(json, 'status')) ?? DocumentStatus.pending,
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        number: readString(json, 'number'),
        issuedAt: readDateTime(json, 'issuedAt'),
        expiresAt: readDateTime(json, 'expiresAt'),
        verifiedAt: readDateTime(json, 'verifiedAt'),
        rejectionReason: readString(json, 'rejectionReason'),
      );

  final String id;
  final DocumentType type;

  /// Signed, short-lived URL — never cached beyond the screen that shows it.
  final String fileUrl;
  final DocumentStatus status;
  final DateTime createdAt;
  final String? number;
  final DateTime? issuedAt;
  final DateTime? expiresAt;
  final DateTime? verifiedAt;
  final String? rejectionReason;

  bool get isApproved => status == DocumentStatus.approved;
  bool get isRejected => status == DocumentStatus.rejected;
  bool get isPending => status == DocumentStatus.pending;

  /// The server marks a document EXPIRED, but the client also warns ahead of
  /// time so a partner is never surprised at the start of a shift.
  bool get isExpired =>
      status == DocumentStatus.expired ||
      (expiresAt != null && expiresAt!.isBefore(DateTime.now()));

  /// Days until expiry; negative once expired, `null` when it never expires.
  int? get daysUntilExpiry {
    final DateTime? expiry = expiresAt;
    if (expiry == null) return null;
    return expiry.difference(DateTime.now()).inDays;
  }

  /// The window in which the documents card turns amber.
  static const int expiryWarningDays = 30;

  bool get isExpiringSoon {
    final int? days = daysUntilExpiry;
    return days != null && days >= 0 && days <= expiryWarningDays;
  }

  /// A document that stops the partner from working and must be re-uploaded.
  bool get needsAction => isRejected || isExpired;
}

/// A payout destination (`POST /partners/me/bank-accounts`).
class BankAccount {
  const BankAccount({
    required this.id,
    required this.bankName,
    required this.accountHolder,
    required this.maskedIban,
    required this.isDefault,
  });

  factory BankAccount.fromJson(JsonMap json) => BankAccount(
        id: readStringOr(json, 'id', ''),
        bankName: readStringOr(json, 'bankName', ''),
        accountHolder: readStringOr(json, 'accountHolder', ''),
        // The API returns only the last four IBAN characters (`ibanLast4`);
        // the raw value never leaves the server.
        maskedIban: readString(json, 'maskedIban') ??
            (readString(json, 'ibanLast4') == null ? readStringOr(json, 'iban', '') : '•••• ${readString(json, 'ibanLast4')}'),
        isDefault: readBoolOr(json, 'isDefault', false),
      );

  final String id;
  final String bankName;
  final String accountHolder;
  final String maskedIban;
  final bool isDefault;
}

/// The full partner profile (`PartnerDto` from `GET /partners/me`).
class PartnerProfile {
  const PartnerProfile({
    required this.id,
    required this.userId,
    required this.phone,
    required this.verificationStatus,
    required this.availability,
    required this.roles,
    required this.rating,
    required this.ratingCount,
    required this.completedJobs,
    required this.acceptanceRate,
    required this.cancellationRate,
    required this.skills,
    required this.categoryIds,
    required this.zoneIds,
    required this.walletBalance,
    required this.documents,
    required this.onboardingStep,
    required this.createdAt,
    this.fullName,
    this.profileImageUrl,
    this.activeVehicleId,
    this.lastHeartbeatAt,
    this.lastLocation,
  });

  factory PartnerProfile.fromJson(JsonMap json) => PartnerProfile(
        id: readStringOr(json, 'id', ''),
        userId: readStringOr(json, 'userId', ''),
        phone: readStringOr(json, 'phone', ''),
        verificationStatus:
            VerificationStatus.fromValue(readString(json, 'verificationStatus')) ?? VerificationStatus.draft,
        availability: AvailabilityStatus.fromValue(readString(json, 'availability')) ?? AvailabilityStatus.offline,
        roles: readStringList(json, 'roles')
            .map(PartnerRoleType.fromValue)
            .whereType<PartnerRoleType>()
            .toList(growable: false),
        rating: readDoubleOr(json, 'rating', 0),
        ratingCount: readIntOr(json, 'ratingCount', 0),
        completedJobs: readIntOr(json, 'completedJobs', 0),
        acceptanceRate: readDoubleOr(json, 'acceptanceRate', 0),
        cancellationRate: readDoubleOr(json, 'cancellationRate', 0),
        skills: readStringList(json, 'skills'),
        categoryIds: readStringList(json, 'categoryIds'),
        zoneIds: readStringList(json, 'zoneIds'),
        walletBalance: readObject<Money>(json, 'walletBalance', Money.fromJson) ?? const Money.zero('ILS'),
        documents: readList<PartnerDocument>(json, 'documents', PartnerDocument.fromJson),
        onboardingStep: readIntOr(json, 'onboardingStep', 0),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        fullName: readString(json, 'fullName'),
        profileImageUrl: readString(json, 'profileImageUrl'),
        activeVehicleId: readString(json, 'activeVehicleId'),
        lastHeartbeatAt: readDateTime(json, 'lastHeartbeatAt'),
        lastLocation: readObject<GeoPoint>(json, 'lastLocation', GeoPoint.fromJson),
      );

  final String id;
  final String userId;
  final String phone;
  final VerificationStatus verificationStatus;
  final AvailabilityStatus availability;
  final List<PartnerRoleType> roles;
  final double rating;
  final int ratingCount;
  final int completedJobs;

  /// 0..1.
  final double acceptanceRate;
  final double cancellationRate;
  final List<String> skills;
  final List<String> categoryIds;
  final List<String> zoneIds;
  final Money walletBalance;
  final List<PartnerDocument> documents;

  /// How far the resumable wizard got: 0 = nothing saved, 7 = submitted.
  final int onboardingStep;
  final DateTime createdAt;
  final String? fullName;
  final String? profileImageUrl;
  final String? activeVehicleId;
  final DateTime? lastHeartbeatAt;
  final GeoPoint? lastLocation;

  bool get isApproved => verificationStatus == VerificationStatus.approved;

  bool get isUnderReview =>
      verificationStatus == VerificationStatus.pending || verificationStatus == VerificationStatus.underReview;

  bool get isRejected => verificationStatus == VerificationStatus.rejected;

  bool get isSuspended => verificationStatus == VerificationStatus.suspended;

  bool get isOnline => availability == AvailabilityStatus.online || availability == AvailabilityStatus.busy;

  /// Any role that needs an approved vehicle before going online.
  bool get needsVehicle =>
      roles.contains(PartnerRoleType.driver) || roles.contains(PartnerRoleType.courier);

  /// Any role whose work is quoted rather than metered.
  bool get isServiceProvider =>
      roles.contains(PartnerRoleType.technician) || roles.contains(PartnerRoleType.serviceProvider);

  /// Documents that block a shift: rejected or expired.
  List<PartnerDocument> get blockingDocuments =>
      documents.where((PartnerDocument d) => d.needsAction).toList(growable: false);

  /// Documents that will block a shift soon.
  List<PartnerDocument> get expiringDocuments =>
      documents.where((PartnerDocument d) => d.isExpiringSoon).toList(growable: false);

  /// The reasons the review team gave, newest first — shown on the rejection
  /// screen so the partner knows exactly what to fix.
  List<PartnerDocument> get rejectedDocuments =>
      documents.where((PartnerDocument d) => d.isRejected).toList(growable: false);

  /// The most recent document of [type], which is the one under review.
  PartnerDocument? documentOf(DocumentType type) {
    PartnerDocument? latest;
    for (final PartnerDocument document in documents) {
      if (document.type != type) continue;
      if (latest == null || document.createdAt.isAfter(latest.createdAt)) latest = document;
    }
    return latest;
  }
}
