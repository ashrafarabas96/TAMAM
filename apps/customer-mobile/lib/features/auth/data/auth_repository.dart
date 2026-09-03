import 'package:tamam_customer/core/device/device_info.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/network/token_refresher.dart';
import 'package:tamam_customer/core/session/user.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';

/// The response of `POST /auth/otp/request`.
class OtpChallenge {
  const OtpChallenge({
    required this.resendAfterSeconds,
    required this.expiresInSeconds,
    this.devCode,
  });

  factory OtpChallenge.fromJson(JsonMap json) => OtpChallenge(
        resendAfterSeconds: readIntOr(json, 'resendAfterSeconds', 45),
        expiresInSeconds: readIntOr(json, 'expiresInSeconds', 300),
        devCode: readString(json, 'devCode'),
      );

  final int resendAfterSeconds;
  final int expiresInSeconds;

  /// Only present outside production, where the SMS provider is a console log.
  final String? devCode;
}

/// The response of `POST /auth/otp/verify`.
class AuthSessionResult {
  const AuthSessionResult({required this.tokens, required this.user, required this.isNewUser});

  final AuthTokens tokens;
  final User user;
  final bool isNewUser;
}

/// Phone + OTP sign-in for the CUSTOMER audience.
class AuthRepository {
  const AuthRepository(this._api);

  static const String _audience = 'CUSTOMER';

  final ApiClient _api;

  Future<OtpChallenge> requestOtp({required String phone, required String language}) async =>
      OtpChallenge.fromJson(
        await _api.postObject(
          ApiPaths.otpRequest,
          body: <String, Object?>{'phone': phone, 'audience': _audience, 'language': language},
        ),
      );

  Future<AuthSessionResult> verifyOtp({
    required String phone,
    required String code,
    required DeviceProfile device,
    required String language,
    String? pushToken,
    String? referralCode,
  }) async {
    final JsonMap json = await _api.postObject(
      ApiPaths.otpVerify,
      body: <String, Object?>{
        'phone': phone,
        'code': code,
        'audience': _audience,
        'device': device.toJson(pushToken: pushToken),
        'language': language,
        if (referralCode != null && referralCode.isNotEmpty) 'referralCode': referralCode,
      },
    );

    final JsonMap tokensJson = asJsonMap(json['tokens']) ?? const <String, Object?>{};
    final AuthTokens? tokens = TokenRefresher.parseTokens(tokensJson);
    if (tokens == null) {
      throw const FormatException('Auth response did not contain tokens');
    }
    return AuthSessionResult(
      tokens: tokens,
      user: User.fromJson(asJsonMap(json['user']) ?? const <String, Object?>{}),
      isNewUser: readBoolOr(json, 'isNewUser', false),
    );
  }
}
