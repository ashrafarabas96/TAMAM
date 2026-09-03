import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/session/user.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Step 3, shown only for a new customer (`isNewUser` / empty `fullName`).
///
/// Completing it flips the session to `signedIn`, which is what moves the
/// router on — the screen itself never navigates.
class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final TextEditingController _controller = TextEditingController();
  bool _busy = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _controller.text = ref.read(sessionControllerProvider).user?.fullName ?? '';
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _isValid => _controller.text.trim().length >= 2;

  Future<void> _save() async {
    if (!_isValid) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final User user = await ref.read(sessionRepositoryProvider).updateProfile(
            fullName: _controller.text.trim(),
          );
      ref.read(sessionControllerProvider.notifier).setUser(user);
    } on Object catch (error) {
      if (mounted) setState(() => _failure = asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return AuthScaffold(
      title: l10n.nameTitle,
      subtitle: l10n.nameSubtitle,
      showBack: false,
      footer: TamamButton(
        label: l10n.actionContinue,
        busy: _busy,
        onPressed: _isValid ? () => unawaited(_save()) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            onChanged: (String _) => setState(() {}),
            onSubmitted: (String _) => unawaited(_save()),
            decoration: InputDecoration(
              labelText: l10n.nameFieldLabel,
              hintText: l10n.nameFieldHint,
              errorText: _failure == null ? null : localizedFailure(l10n, _failure!),
              constraints: const BoxConstraints(minHeight: TamamSize.inputHeight),
            ),
          ),
          const SizedBox(height: TamamSpacing.s4),
          Text(
            l10n.nameWhy,
            style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
