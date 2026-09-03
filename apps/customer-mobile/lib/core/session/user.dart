import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';

/// Customer-side counters returned inside `UserDto.customer`.
class CustomerProfile {
  const CustomerProfile({
    required this.rating,
    required this.ratingCount,
    required this.completedJobs,
    required this.cancelledJobs,
    required this.referralCode,
  });

  factory CustomerProfile.fromJson(JsonMap json) => CustomerProfile(
        rating: readDoubleOr(json, 'rating', 0),
        ratingCount: readIntOr(json, 'ratingCount', 0),
        completedJobs: readIntOr(json, 'completedJobs', 0),
        cancelledJobs: readIntOr(json, 'cancelledJobs', 0),
        referralCode: readStringOr(json, 'referralCode', ''),
      );

  final double rating;
  final int ratingCount;
  final int completedJobs;
  final int cancelledJobs;
  final String referralCode;
}

/// The signed-in customer (`UserDto`).
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
    this.customer,
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
        customer: readObject<CustomerProfile>(json, 'customer', CustomerProfile.fromJson),
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
  final CustomerProfile? customer;

  /// A new customer has not told us their name yet — onboarding asks for it.
  bool get needsName => fullName == null || fullName!.trim().isEmpty;

  bool get isSuspended => accountStatus == AccountStatus.suspended;
  bool get isRestricted => accountStatus == AccountStatus.restricted;

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
