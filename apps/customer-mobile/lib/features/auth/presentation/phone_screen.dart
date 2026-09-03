import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/session/session_state.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/phone_field.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/auth/presentation/auth_controller.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Step 1 of sign-in: the phone number, defaulting to +970.
class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  String? _phone;

  Future<void> _submit() async {
    final String? phone = _phone;
    if (phone == null) return;
    FocusScope.of(context).unfocus();
    final bool ok = await ref.read(authControllerProvider.notifier).requestOtp(phone);
    if (!mounted || !ok) return;
    context.push(Routes.otp);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AuthFlowState auth = ref.watch(authControllerProvider);
    final SignedOutReason? reason = ref.watch(sessionControllerProvider).signedOutReason;

    return AuthScaffold(
      title: l10n.signInTitle,
      subtitle: l10n.signInSubtitle,
      showBack: false,
      footer: TamamButton(
        label: l10n.signInSendCode,
        busy: auth.busy,
        onPressed: _phone == null ? null : () => unawaited(_submit()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (reason != null && reason != SignedOutReason.userRequested)
            _Notice(message: _reasonMessage(l10n, reason)),
          PhoneField(
            label: l10n.signInPhoneLabel,
            hint: l10n.signInPhoneHint,
            autofocus: true,
            errorText: auth.failure == null ? null : localizedFailure(l10n, auth.failure!),
            onChanged: (String? value) => setState(() => _phone = value),
            onSubmitted: () => unawaited(_submit()),
          ),
          const SizedBox(height: TamamSpacing.s4),
          Text(
            l10n.signInOtpExplainer,
            style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: TamamSpacing.s6),
          Text(
            l10n.signInTerms,
            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }

  String _reasonMessage(AppLocalizations l10n, SignedOutReason reason) {
    switch (reason) {
      case SignedOutReason.suspended:
        return l10n.errorAccountSuspended;
      case SignedOutReason.revoked:
        return l10n.signedOutRevoked;
      case SignedOutReason.expired:
      case SignedOutReason.userRequested:
        return l10n.signedOutExpired;
    }
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Container(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s4),
      padding: const EdgeInsets.all(TamamSpacing.s3),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: BorderRadius.circular(TamamRadius.md),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.info_outline_rounded, size: TamamSize.iconMd, color: TamamSemantic.warningStrong),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(
            child: Text(
              message,
              style: TamamType.bodySm.toTextStyle(color: TamamSemantic.warningStrong),
            ),
          ),
        ],
      ),
    );
  }
}
