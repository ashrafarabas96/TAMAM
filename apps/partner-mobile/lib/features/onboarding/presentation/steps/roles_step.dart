import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 2: what kind of work the partner wants. Multi-select, at least one.
///
/// The choice decides the rest of the wizard: skills for technicians and
/// service providers, a vehicle for drivers and couriers.
class RolesStep extends ConsumerStatefulWidget {
  const RolesStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<RolesStep> createState() => _RolesStepState();
}

class _RolesStepState extends ConsumerState<RolesStep> {
  late Set<PartnerRoleType> _selected = widget.state.roles.toSet();

  static String _caption(AppLocalizations l10n, PartnerRoleType role) {
    switch (role) {
      case PartnerRoleType.driver:
        return l10n.roleDriverCaption;
      case PartnerRoleType.courier:
        return l10n.roleCourierCaption;
      case PartnerRoleType.technician:
        return l10n.roleTechnicianCaption;
      case PartnerRoleType.serviceProvider:
        return l10n.roleServiceProviderCaption;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingRolesHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s4),
        for (final PartnerRoleType role in PartnerRoleType.values)
          TamamCard(
            margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
            border: Border.all(
              color: _selected.contains(role) ? colors.primary : colors.border,
              width: _selected.contains(role) ? 1.6 : 1,
            ),
            onTap: () => setState(() {
              _selected = _selected.contains(role)
                  ? _selected.where((PartnerRoleType r) => r != role).toSet()
                  : <PartnerRoleType>{..._selected, role};
            }),
            child: Row(
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: colors.surfaceBrandSoft, shape: BoxShape.circle),
                  child: Icon(JobLabels.roleIcon(role), color: colors.primary),
                ),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(JobLabels.role(l10n, role), style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
                      Text(_caption(l10n, role), style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
                    ],
                  ),
                ),
                Checkbox(
                  value: _selected.contains(role),
                  onChanged: (bool? value) => setState(() {
                    _selected = value ?? false
                        ? <PartnerRoleType>{..._selected, role}
                        : _selected.where((PartnerRoleType r) => r != role).toSet();
                  }),
                ),
              ],
            ),
          ),
        if (widget.state.failure != null) ...<Widget>[
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
          onPressed: _selected.isEmpty
              ? null
              : () => unawaited(ref.read(onboardingProvider.notifier).saveRoles(_selected.toList(growable: false))),
        ),
      ],
    );
  }
}
