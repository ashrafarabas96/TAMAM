import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';

/// `POST /partners/onboarding/personal` (`partnerOnboardingPersonalSchema`).
class PersonalInfoInput {
  const PersonalInfoInput({
    required this.fullName,
    required this.dateOfBirth,
    required this.nationalId,
    required this.city,
    this.email,
    this.profileImageMediaId,
  });

  final String fullName;

  /// `YYYY-MM-DD` exactly as the schema demands.
  final String dateOfBirth;
  final String nationalId;
  final String city;
  final String? email;
  final String? profileImageMediaId;

  JsonMap toJson() => <String, Object?>{
        'fullName': fullName.trim(),
        'dateOfBirth': dateOfBirth,
        'nationalId': nationalId.trim(),
        'city': city.trim(),
        if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
        if (profileImageMediaId != null) 'profileImageMediaId': profileImageMediaId,
      };
}

/// The seven wizard steps, all resumable: every one is a separate POST that
/// the server records, and `PartnerProfile.onboardingStep` says how far the
/// partner got — so a reinstall resumes exactly where they stopped.
class OnboardingRepository {
  const OnboardingRepository(this._api);

  final ApiClient _api;

  Future<PartnerProfile> savePersonal(PersonalInfoInput input) async =>
      PartnerProfile.fromJson(await _api.postObject(ApiPaths.onboardingPersonal, body: input.toJson()));

  Future<PartnerProfile> saveRoles(List<PartnerRoleType> roles) async => PartnerProfile.fromJson(
        await _api.postObject(
          ApiPaths.onboardingRoles,
          body: <String, Object?>{'roles': roles.map((PartnerRoleType r) => r.value).toList(growable: false)},
        ),
      );

  Future<PartnerProfile> saveSkills({
    required List<String> categoryIds,
    List<String> skills = const <String>[],
    int? yearsOfExperience,
  }) async =>
      PartnerProfile.fromJson(
        await _api.postObject(
          ApiPaths.onboardingSkills,
          body: <String, Object?>{
            'categoryIds': categoryIds,
            'skills': skills,
            if (yearsOfExperience != null) 'yearsOfExperience': yearsOfExperience,
          },
        ),
      );

  /// `POST /partners/onboarding/documents` — one document at a time, after the
  /// media upload intent → PUT → confirm dance completed.
  Future<PartnerDocument> addDocument({
    required DocumentType type,
    required String mediaId,
    String? number,
    String? issuedAt,
    String? expiresAt,
  }) async =>
      PartnerDocument.fromJson(
        await _api.postObject(
          ApiPaths.onboardingDocuments,
          body: <String, Object?>{
            'type': type.value,
            'mediaId': mediaId,
            if (number != null && number.trim().isNotEmpty) 'number': number.trim(),
            if (issuedAt != null) 'issuedAt': issuedAt,
            if (expiresAt != null) 'expiresAt': expiresAt,
          },
        ),
      );

  /// `POST /partners/onboarding/vehicle` (`partnerVehicleSchema`).
  Future<PartnerProfile> saveVehicle(JsonMap vehicle) async =>
      PartnerProfile.fromJson(await _api.postObject(ApiPaths.onboardingVehicle, body: vehicle));

  Future<PartnerProfile> saveZones(List<String> zoneIds) async => PartnerProfile.fromJson(
        await _api.postObject(ApiPaths.onboardingZones, body: <String, Object?>{'zoneIds': zoneIds}),
      );

  /// `POST /partners/onboarding/submit` — hands the file to the review team.
  Future<PartnerProfile> submit({required String acceptedTermsVersion}) async => PartnerProfile.fromJson(
        await _api.postObject(
          ApiPaths.onboardingSubmit,
          body: <String, Object?>{'acceptedTermsVersion': acceptedTermsVersion},
        ),
      );
}
