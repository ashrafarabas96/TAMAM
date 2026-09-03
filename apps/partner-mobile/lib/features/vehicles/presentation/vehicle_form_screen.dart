import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/vehicles/data/vehicles_repository.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/features/vehicles/presentation/widgets/vehicle_form.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Register an additional vehicle. It goes to review before it can be
/// activated, which the screen says up front.
class VehicleFormScreen extends ConsumerStatefulWidget {
  const VehicleFormScreen({super.key});

  @override
  ConsumerState<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends ConsumerState<VehicleFormScreen> {
  VehicleInput? _input;
  bool _busy = false;
  AppFailure? _failure;

  Future<void> _submit() async {
    final VehicleInput? input = _input;
    if (input == null) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      await ref.read(vehiclesRepositoryProvider).create(input);
      ref
        ..invalidate(vehiclesProvider)
        ..invalidate(partnerProfileProvider);
      if (!mounted) return;
      AppFeedback.showMessage(context, context.l10n.vehicleSubmittedForReview, icon: Icons.check_rounded);
      context.pop();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _failure = failure;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.vehiclesAdd)),
      body: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(TamamSpacing.s4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    l10n.vehicleReviewNotice,
                    style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                  ),
                  const SizedBox(height: TamamSpacing.s4),
                  VehicleForm(
                    fieldErrors: _failure?.errorFor,
                    onChanged: (VehicleInput? input) => setState(() => _input = input),
                  ),
                  if (_failure != null && _failure!.fieldErrors.isEmpty) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s3),
                    Text(
                      localizedFailure(l10n, _failure!),
                      style: TamamType.bodySm.toTextStyle(color: colors.danger),
                    ),
                  ],
                  const SizedBox(height: TamamSpacing.s8),
                ],
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, 0, TamamSpacing.s4, TamamSpacing.s4),
              child: TamamButton(
                label: l10n.actionSave,
                busy: _busy,
                onPressed: _input == null ? null : () => unawaited(_submit()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
