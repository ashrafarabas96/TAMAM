import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';

/// The partner counters returned inside `UserDto.partner` (`PartnerSummaryDto`).
///
/// This is the small view the session needs to decide where the partner belongs:
/// onboarding, the review screen, or the working home. The full profile comes
/// from `GET /partners/me`.
class PartnerSummary {
  const PartnerSummary({
    required this.id,
    required this.verificationStatus,
    required this.availability,
    required this.roles,
    required this.rating,
    required this.ratingCount,
    required this.completedJobs,
    required this.acceptanceRate,
    required this.cancellationRate,
  });

  factory PartnerSummary.fromJson(JsonMap json) => PartnerSummary(
        id: readStringOr(json, 'id', ''),
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
      );

  final String id;
  final VerificationStatus verificationStatus;
  final AvailabilityStatus availability;
  final List<PartnerRoleType> roles;
  final double rating;
  final int ratingCount;
  final int completedJobs;

  /// 0..1 — shown as a percentage on the home stats row.
  final double acceptanceRate;
  final double cancellationRate;

  /// Only an approved partner may go online and receive offers.
  bool get isApproved => verificationStatus == VerificationStatus.approved;

  /// The account is with the review team; the app shows a status screen.
  bool get isUnderReview =>
      verificationStatus == VerificationStatus.pending || verificationStatus == VerificationStatus.underReview;

  bool get isRejected => verificationStatus == VerificationStatus.rejected;

  bool get isSuspended => verificationStatus == VerificationStatus.suspended;

  /// The wizard is still open (nothing submitted yet, or a rejection to fix).
  bool get needsOnboarding => verificationStatus == VerificationStatus.draft || isRejected;
}

/// The signed-in partner (`UserDto`).
class User {
  const User({
    required this.id,
    required this.phone,
    required this.language,
    required this.currency,
    required this.roles,
    required this.accountStatus,
    required this.createdAt,
    this.email,
    this.fullName,
    this.profileImageUrl,
    this.partner,
  });

  factory User.fromJson(JsonMap json) => User(
        id: readStringOr(json, 'id', ''),
        phone: readStringOr(json, 'phone', ''),
        language: Language.fromValue(readString(json, 'language')) ?? Language.ar,
        currency: readStringOr(json, 'currency', 'ILS'),
        roles: readStringList(json, 'roles')
            .map(UserRole.fromValue)
            .whereType<UserRole>()
            .toList(growable: false),
        accountStatus: AccountStatus.fromValue(readString(json, 'accountStatus')) ?? AccountStatus.active,
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        email: readString(json, 'email'),
        fullName: readString(json, 'fullName'),
        profileImageUrl: readString(json, 'profileImageUrl'),
        partner: readObject<PartnerSummary>(json, 'partner', PartnerSummary.fromJson),
      );

  final String id;
  final String phone;
  final Language language;
  final String currency;
  final List<UserRole> roles;
  final AccountStatus accountStatus;
  final DateTime createdAt;
  final String? email;
  final String? fullName;
  final String? profileImageUrl;
  final PartnerSummary? partner;

  bool get isSuspended => accountStatus == AccountStatus.suspended;
  bool get isRestricted => accountStatus == AccountStatus.restricted;

  /// A brand-new partner has no profile row yet — the wizard starts at step 1.
  bool get needsOnboarding => partner == null || partner!.needsOnboarding;

  bool get isApprovedPartner => partner?.isApproved ?? false;

  /// Initials for the avatar fallback (up to two letters).
  String get initials {
    final String name = fullName?.trim() ?? '';
    if (name.isEmpty) return '#';
    final List<String> parts = name.split(RegExp(r'\s+')).where((String p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '#';
    if (parts.length == 1) {
      return parts.first.length <= 2 ? parts.first : parts.first.substring(0, 2);
    }
    return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}';
  }
}
