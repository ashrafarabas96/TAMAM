import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/features/vehicles/data/vehicles_repository.dart';
import 'package:tamam_partner/features/vehicles/presentation/widgets/vehicle_form.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 5 (drivers and couriers only): the vehicle they will work with.
class VehicleStep extends ConsumerStatefulWidget {
  const VehicleStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<VehicleStep> createState() => _VehicleStepState();
}

class _VehicleStepState extends ConsumerState<VehicleStep> {
  VehicleInput? _input;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingVehicleHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s4),
        VehicleForm(
          fieldErrors: widget.state.failure == null ? null : widget.state.failure!.errorFor,
          onChanged: (VehicleInput? input) => setState(() => _input = input),
        ),
        if (widget.state.failure != null && widget.state.failure!.fieldErrors.isEmpty) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Text(
            localizedFailure(l10n, widget.state.failure!),
            style: TamamType.bodySm.toTextStyle(color: colors.danger),
          ),
        ],
        const SizedBox(height: TamamSpacing.s6),
        TamamButton(
          label: l10n.actionNext,
          busy: widget.state.busy,
          onPressed: _input == null
              ? null
              : () => unawaited(ref.read(onboardingProvider.notifier).saveVehicle(_input!.toJson())),
        ),
      ],
    );
  }
}
