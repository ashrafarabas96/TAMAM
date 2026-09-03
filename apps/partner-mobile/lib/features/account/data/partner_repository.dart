import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';

/// `PartnerAvailabilityDto` — the server's view of the shift.
class PartnerAvailability {
  const PartnerAvailability({
    required this.status,
    required this.activeRoles,
    required this.heartbeatIntervalSeconds,
    this.activeVehicleId,
    this.currentJobId,
    this.lastHeartbeatAt,
    this.onlineSince,
  });

  factory PartnerAvailability.fromJson(JsonMap json) => PartnerAvailability(
        status: AvailabilityStatus.fromValue(readString(json, 'status')) ?? AvailabilityStatus.offline,
        activeRoles: readStringList(json, 'activeRoles')
            .map(PartnerRoleType.fromValue)
            .whereType<PartnerRoleType>()
            .toList(growable: false),
        heartbeatIntervalSeconds: readIntOr(json, 'heartbeatIntervalSeconds', 30),
        activeVehicleId: readString(json, 'activeVehicleId'),
        currentJobId: readString(json, 'currentJobId'),
        lastHeartbeatAt: readDateTime(json, 'lastHeartbeatAt'),
        onlineSince: readDateTime(json, 'onlineSince'),
      );

  const PartnerAvailability.offline()
      : status = AvailabilityStatus.offline,
        activeRoles = const <PartnerRoleType>[],
        heartbeatIntervalSeconds = 30,
        activeVehicleId = null,
        currentJobId = null,
        lastHeartbeatAt = null,
        onlineSince = null;

  final AvailabilityStatus status;
  final List<PartnerRoleType> activeRoles;

  /// The cadence the server expects; the work session adopts it.
  final int heartbeatIntervalSeconds;
  final String? activeVehicleId;
  final String? currentJobId;
  final DateTime? lastHeartbeatAt;
  final DateTime? onlineSince;

  bool get isOnline => status == AvailabilityStatus.online || status == AvailabilityStatus.busy;
  bool get hasActiveJob => currentJobId != null && currentJobId!.isNotEmpty;
}

/// `HeartbeatResultDto`.
class HeartbeatResult {
  const HeartbeatResult({
    required this.status,
    required this.heartbeatIntervalSeconds,
    required this.locationAccepted,
    this.currentJobId,
  });

  factory HeartbeatResult.fromJson(JsonMap json) => HeartbeatResult(
        status: AvailabilityStatus.fromValue(readString(json, 'status')) ?? AvailabilityStatus.offline,
        heartbeatIntervalSeconds: readIntOr(json, 'heartbeatIntervalSeconds', 30),
        locationAccepted: readBoolOr(json, 'locationAccepted', false),
        currentJobId: readString(json, 'currentJobId'),
      );

  final AvailabilityStatus status;
  final int heartbeatIntervalSeconds;
  final bool locationAccepted;
  final String? currentJobId;
}

/// Everything under `/partners/me` that is not a job: profile, documents,
/// availability, heartbeat, bank accounts.
class PartnerRepository {
  const PartnerRepository(this._api);

  final ApiClient _api;

  Future<PartnerProfile> me() async => PartnerProfile.fromJson(await _api.getObject(ApiPaths.partnerMe));

  Future<List<PartnerDocument>> documents() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.partnerDocuments);
    return raw.map(PartnerDocument.fromJson).toList(growable: false);
  }

  /// `POST /partners/me/documents` (`partnerDocumentUploadSchema`).
  Future<PartnerDocument> addDocument({
    required DocumentType type,
    required String mediaId,
    String? number,
    String? issuedAt,
    String? expiresAt,
  }) async =>
      PartnerDocument.fromJson(
        await _api.postObject(
          ApiPaths.partnerDocuments,
          body: <String, Object?>{
            'type': type.value,
            'mediaId': mediaId,
            if (number != null && number.isNotEmpty) 'number': number,
            if (issuedAt != null) 'issuedAt': issuedAt,
            if (expiresAt != null) 'expiresAt': expiresAt,
          },
        ),
      );

  Future<PartnerAvailability> availability() async =>
      PartnerAvailability.fromJson(await _api.getObject(ApiPaths.partnerAvailability));

  /// `PUT /partners/me/availability` (`setAvailabilitySchema`).
  Future<PartnerAvailability> setAvailability({
    required AvailabilityStatus status,
    LocationSample? location,
    String? activeVehicleId,
    List<PartnerRoleType>? activeRoles,
  }) async =>
      PartnerAvailability.fromJson(
        await _api.putObject(
          ApiPaths.partnerAvailability,
          body: <String, Object?>{
            'status': status.value,
            if (location != null) 'location': location.toJson(),
            if (activeVehicleId != null) 'activeVehicleId': activeVehicleId,
            if (activeRoles != null && activeRoles.isNotEmpty)
              'activeRoles': activeRoles.map((PartnerRoleType r) => r.value).toList(growable: false),
          },
        ),
      );

  /// `POST /partners/me/heartbeat` (`heartbeatSchema`).
  Future<HeartbeatResult> heartbeat({
    LocationSample? location,
    int? batteryPercent,
    String? networkType,
  }) async =>
      HeartbeatResult.fromJson(
        await _api.postObject(
          ApiPaths.partnerHeartbeat,
          body: <String, Object?>{
            if (location != null) 'location': location.toJson(),
            if (batteryPercent != null) 'batteryPercent': batteryPercent,
            if (networkType != null) 'networkType': networkType,
          },
        ),
      );

  /// `POST /partners/me/location` — the REST fallback for a location batch.
  Future<void> pushLocations(List<LocationSample> samples, {String? jobId}) async {
    await _api.postObject(
      ApiPaths.partnerLocation,
      body: <String, Object?>{
        'samples': samples.map((LocationSample s) => s.toJson()).toList(growable: false),
        if (jobId != null) 'jobId': jobId,
      },
    );
  }

  Future<List<BankAccount>> bankAccounts() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.partnerBankAccounts);
    return raw.map(BankAccount.fromJson).toList(growable: false);
  }

  Future<BankAccount> addBankAccount({
    required String bankName,
    required String accountHolder,
    required String iban,
    bool isDefault = true,
  }) async =>
      BankAccount.fromJson(
        await _api.postObject(
          ApiPaths.partnerBankAccounts,
          body: <String, Object?>{
            'bankName': bankName,
            'accountHolder': accountHolder,
            'iban': iban,
            'isDefault': isDefault,
          },
        ),
      );
}
