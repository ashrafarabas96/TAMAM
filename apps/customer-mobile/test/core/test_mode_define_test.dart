import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/env/app_env.dart';

/// Run twice, with and without the define:
///   flutter test --dart-define=TEST_MODE=true test/core/test_mode_define_test.dart
/// A release build made for local testing relies on this define to show the OTP
/// code the API returns; if the name ever drifts, the build still succeeds and
/// the tester is simply stuck, so the wiring is asserted rather than assumed.
void main() {
  test('TEST_MODE reflects the --dart-define given to this run', () {
    const bool expected = bool.fromEnvironment('TEST_MODE');
    expect(AppEnv.testMode, expected);
  });
}
