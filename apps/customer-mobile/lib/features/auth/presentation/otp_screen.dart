import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/format/phone_formatter.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/auth/data/auth_repository.dart';
import 'package:tamam_customer/features/auth/presentation/auth_controller.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/otp_input.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Step 2 of sign-in: the six-digit code, with a resend countdown driven by the
/// server's `resendAfterSeconds`.
///
/// Navigation away from here is the router's job: once the session exists the
/// redirect sends the customer to name capture or home.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, this.referralCode});

  /// Carried over from a `tamam://invite/<code>` deep link.
  final String? referralCode;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final GlobalKey<OtpInputState> _inputKey = GlobalKey<OtpInputState>();
  Timer? _ticker;
  int _secondsLeft = 0;
  String _code = '';

  @override
  void initState() {
    super.initState();
    _startCountdown(ref.read(authControllerProvider).challenge?.resendAfterSeconds ?? 45);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _ticker?.cancel();
    setState(() => _secondsLeft = seconds);
    _ticker = Timer.periodic(const Duration(seconds: 1), (Timer timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _secondsLeft = _secondsLeft <= 1 ? 0 : _secondsLeft - 1);
      if (_secondsLeft == 0) timer.cancel();
    });
  }

  Future<void> _verify(String code) async {
    FocusScope.of(context).unfocus();
    final bool ok = await ref
        .read(authControllerProvider.notifier)
        .verify(code, referralCode: widget.referralCode);
    if (!ok) _inputKey.currentState?.clear();
  }

  Future<void> _resend() async {
    final bool ok = await ref.read(authControllerProvider.notifier).resend();
    if (!mounted || !ok) return;
    _startCountdown(ref.read(authControllerProvider).challenge?.resendAfterSeconds ?? 45);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AuthFlowState auth = ref.watch(authControllerProvider);
    final OtpChallenge? challenge = auth.challenge;
    final bool showDevCode = ref.watch(appEnvProvider).showsDevOtpCode && challenge?.devCode != null;

    return AuthScaffold(
      title: l10n.otpTitle,
      subtitle: l10n.otpSubtitle(PhoneFormatter.pretty(auth.phone ?? '')),
      footer: TamamButton(
        label: l10n.otpVerify,
        busy: auth.busy,
        onPressed: _code.length < 6 ? null : () => unawaited(_verify(_code)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          OtpInput(
            key: _inputKey,
            enabled: !auth.busy,
            hasError: auth.failure != null,
            onChanged: (String value) {
              if (auth.failure != null) ref.read(authControllerProvider.notifier).clearFailure();
              setState(() => _code = value);
            },
            onCompleted: (String value) => unawaited(_verify(value)),
          ),
          if (auth.failure != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            Text(
              localizedFailure(l10n, auth.failure!),
              style: TamamType.bodySm.toTextStyle(color: colors.danger),
            ),
          ],
          const SizedBox(height: TamamSpacing.s6),
          Center(
            child: _secondsLeft > 0
                ? Text(
                    l10n.otpResendIn(_secondsLeft),
                    style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                  )
                : TextButton(
                    onPressed: auth.busy ? null : () => unawaited(_resend()),
                    child: Text(l10n.otpResend),
                  ),
          ),
          if (showDevCode) ...<Widget>[
            const SizedBox(height: TamamSpacing.s5),
            Container(
              padding: const EdgeInsets.all(TamamSpacing.s3),
              decoration: BoxDecoration(
                color: colors.infoSoft,
                borderRadius: BorderRadius.circular(TamamRadius.md),
              ),
              child: Text(
                l10n.otpDevCode(challenge!.devCode!),
                style: TamamType.labelMd.toTextStyle(color: TamamSemantic.infoStrong),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
