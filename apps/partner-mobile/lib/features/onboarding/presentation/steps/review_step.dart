import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_tile.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 7: everything the partner entered, the terms, and submit.
///
/// Each block links back to its step, so a mistake is one tap from being fixed
/// rather than a restart.
class ReviewStep extends ConsumerStatefulWidget {
  const ReviewStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends ConsumerState<ReviewStep> {
  bool _accepted = false;

  Future<void> _submit() async {
    final bool ok = await ref.read(onboardingProvider.notifier).submit();
    if (ok && mounted) context.go(Routes.onboardingStatus);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final PartnerProfile? profile = widget.state.profile;
    final String language = Localizations.localeOf(context).languageCode;
    final List<ServiceCategory> categories = ref.watch(serviceCategoriesProvider).valueOrNull ?? const <ServiceCategory>[];
    final List<ServiceZone> zones = ref.watch(serviceZonesProvider).valueOrNull ?? const <ServiceZone>[];
    final OnboardingController controller = ref.read(onboardingProvider.notifier);

    if (profile == null) {
      return Text(l10n.onboardingReviewIncomplete, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary));
    }

    final List<DocumentType> required = OnboardingFlow.requiredDocuments(profile.roles);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingReviewHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s4),
        _Block(
          title: l10n.onboardingStepPersonal,
          onEdit: () => controller.goTo(OnboardingStep.personal),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(profile.fullName ?? '', style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
              Text(profile.phone, textDirection: TextDirection.ltr, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
            ],
          ),
        ),
        _Block(
          title: l10n.onboardingStepRoles,
          onEdit: () => controller.goTo(OnboardingStep.roles),
          child: Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: <Widget>[
              for (final PartnerRoleType role in profile.roles)
                StatusPill(label: JobLabels.role(l10n, role), tone: PillTone.brand, icon: JobLabels.roleIcon(role)),
            ],
          ),
        ),
        if (OnboardingFlow.appliesTo(OnboardingStep.skills, profile.roles))
          _Block(
            title: l10n.onboardingStepSkills,
            onEdit: () => controller.goTo(OnboardingStep.skills),
            child: Wrap(
              spacing: TamamSpacing.s2,
              runSpacing: TamamSpacing.s2,
              children: <Widget>[
                for (final ServiceCategory category in categories)
                  if (profile.categoryIds.contains(category.id))
                    StatusPill(label: category.name.resolve(language), dense: true),
                for (final String skill in profile.skills) StatusPill(label: skill, dense: true),
              ],
            ),
          ),
        _Block(
          title: l10n.onboardingStepDocuments,
          onEdit: () => controller.goTo(OnboardingStep.documents),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              for (final DocumentType type in required)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          JobLabels.documentType(l10n, type),
                          style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                        ),
                      ),
                      if (profile.documentOf(type) case final PartnerDocument doc)
                        StatusPill(
                          label: DocumentTile.statusLabel(l10n, doc.status),
                          tone: DocumentTile.statusTone(doc.status),
                          dense: true,
                        )
                      else
                        StatusPill(label: l10n.documentNotUploaded, tone: PillTone.danger, dense: true),
                    ],
                  ),
                ),
            ],
          ),
        ),
        _Block(
          title: l10n.onboardingStepZones,
          onEdit: () => controller.goTo(OnboardingStep.zones),
          child: Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: <Widget>[
              for (final ServiceZone zone in zones)
                if (profile.zoneIds.contains(zone.id)) StatusPill(label: zone.name.resolve(language), dense: true),
            ],
          ),
        ),
        const SizedBox(height: TamamSpacing.s3),
        CheckboxListTile(
          value: _accepted,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: Text(l10n.onboardingAcceptTerms, style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary)),
          subtitle: TextButton(
            onPressed: () => context.push(Routes.legal),
            style: TextButton.styleFrom(padding: EdgeInsets.zero, alignment: AlignmentDirectional.centerStart),
            child: Text(l10n.onboardingReadTerms),
          ),
          onChanged: (bool? value) => setState(() => _accepted = value ?? false),
        ),
        if (widget.state.failure != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s2),
          Text(localizedFailure(l10n, widget.state.failure!), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
        ],
        const SizedBox(height: TamamSpacing.s4),
        TamamButton(
          label: l10n.onboardingSubmit,
          busy: widget.state.busy,
          onPressed: _accepted ? () => unawaited(_submit()) : null,
        ),
      ],
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.onEdit, required this.child});

  final String title;
  final VoidCallback onEdit;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(title, style: TamamType.labelMd.toTextStyle(color: colors.textTertiary))),
              TextButton(onPressed: onEdit, child: Text(context.l10n.actionChange)),
            ],
          ),
          child,
        ],
      ),
    );
  }
}
