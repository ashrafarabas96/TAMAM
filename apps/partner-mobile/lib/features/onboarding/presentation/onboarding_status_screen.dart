import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_tile.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_upload_sheet.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Where a submitted partner waits — and where a rejected one learns exactly
/// what to fix.
///
/// PENDING / UNDER_REVIEW show "قيد المراجعة"; REJECTED lists every rejected
/// document with the reviewer's reason and a button that re-opens the upload
/// sheet for that document alone.
class OnboardingStatusScreen extends ConsumerWidget {
  const OnboardingStatusScreen({super.key});

  Future<void> _reupload(BuildContext context, WidgetRef ref, DocumentType type) async {
    final DocumentUploadResult? result = await DocumentUploadSheet.show(context, type: type);
    if (result == null) return;
    await ref.read(onboardingProvider.notifier).addDocument(
          type: result.type,
          mediaId: result.mediaId,
          number: result.number,
          issuedAt: result.issuedAt,
          expiresAt: result.expiresAt,
        );
    ref.invalidate(partnerProfileProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.onboardingStatusTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.actionRetry,
            onPressed: () {
              ref.invalidate(partnerProfileProvider);
              unawaited(ref.read(sessionControllerProvider.notifier).refreshUser());
            },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: AsyncView<PartnerProfile>(
              value: ref.watch(partnerProfileProvider),
              onRetry: () => ref.invalidate(partnerProfileProvider),
              builder: (PartnerProfile profile) => RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(partnerProfileProvider);
                  await ref.read(sessionControllerProvider.notifier).refreshUser();
                },
                child: ListView(
                  padding: const EdgeInsets.all(TamamSpacing.s4),
                  children: <Widget>[
                    _StatusHero(profile: profile),
                    const SizedBox(height: TamamSpacing.s4),
                    if (profile.isRejected) ...<Widget>[
                      Text(
                        l10n.onboardingRejectedWhatToFix,
                        style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                      ),
                      const SizedBox(height: TamamSpacing.s2),
                      if (profile.rejectedDocuments.isEmpty)
                        TamamCard(
                          background: colors.warningSoft,
                          elevated: false,
                          child: Text(
                            l10n.onboardingRejectedNoDocumentDetail,
                            style: TamamType.bodyMd.toTextStyle(color: TamamSemantic.warningStrong),
                          ),
                        )
                      else
                        for (final PartnerDocument doc in profile.rejectedDocuments)
                          DocumentTile(
                            type: doc.type,
                            document: doc,
                            onUpload: () => unawaited(_reupload(context, ref, doc.type)),
                          ),
                      const SizedBox(height: TamamSpacing.s4),
                      TamamButton(
                        label: l10n.onboardingResubmit,
                        onPressed: () => context.go(Routes.onboarding),
                      ),
                    ] else ...<Widget>[
                      _Timeline(profile: profile),
                      const SizedBox(height: TamamSpacing.s4),
                      TamamButton(
                        label: l10n.onboardingContactSupport,
                        variant: TamamButtonVariant.outline,
                        onPressed: () => context.push(Routes.support),
                      ),
                    ],
                    const SizedBox(height: TamamSpacing.s3),
                    TamamButton(
                      label: l10n.accountSignOut,
                      variant: TamamButtonVariant.ghost,
                      onPressed: () => unawaited(ref.read(sessionControllerProvider.notifier).signOut()),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusHero extends StatelessWidget {
  const _StatusHero({required this.profile});

  final PartnerProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final (IconData icon, Color tone, Color soft, String title, String body) = switch (profile.verificationStatus) {
      VerificationStatus.pending || VerificationStatus.underReview => (
          Icons.hourglass_top_rounded,
          colors.warning,
          colors.warningSoft,
          l10n.onboardingUnderReviewTitle,
          l10n.onboardingUnderReviewBody,
        ),
      VerificationStatus.rejected => (
          Icons.gpp_bad_rounded,
          colors.danger,
          colors.dangerSoft,
          l10n.onboardingRejectedTitle,
          l10n.onboardingRejectedBody,
        ),
      VerificationStatus.suspended => (
          Icons.pause_circle_rounded,
          colors.danger,
          colors.dangerSoft,
          l10n.onboardingSuspendedTitle,
          l10n.onboardingSuspendedBody,
        ),
      VerificationStatus.approved => (
          Icons.verified_rounded,
          colors.success,
          colors.successSoft,
          l10n.onboardingApprovedTitle,
          l10n.onboardingApprovedBody,
        ),
      VerificationStatus.draft => (
          Icons.edit_note_rounded,
          colors.primary,
          colors.surfaceBrandSoft,
          l10n.onboardingDraftTitle,
          l10n.onboardingDraftBody,
        ),
    };

    return TamamCard(
      child: Column(
        children: <Widget>[
          Container(
            width: 88,
            height: 88,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: soft, shape: BoxShape.circle),
            child: Icon(icon, size: 44, color: tone),
          ),
          const SizedBox(height: TamamSpacing.s4),
          Text(title, textAlign: TextAlign.center, style: TamamType.headingMd.toTextStyle(color: colors.textPrimary)),
          const SizedBox(height: TamamSpacing.s2),
          Text(body, textAlign: TextAlign.center, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        ],
      ),
    );
  }
}

/// What has been received and what the review team still has to do.
class _Timeline extends ConsumerWidget {
  const _Timeline({required this.profile});

  final PartnerProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final List<DocumentType> required = OnboardingFlow.requiredDocuments(profile.roles);
    final int approved = required.where((DocumentType t) => profile.documentOf(t)?.isApproved ?? false).length;

    return TamamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(l10n.onboardingReviewProgress, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
          const SizedBox(height: TamamSpacing.s2),
          LinearProgressIndicator(
            value: required.isEmpty ? 0 : approved / required.length,
            backgroundColor: colors.skeleton,
          ),
          const SizedBox(height: TamamSpacing.s2),
          Text(
            l10n.onboardingDocumentsApproved(approved, required.length),
            style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: TamamSpacing.s3),
          for (final DocumentType type in required)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: <Widget>[
                  Icon(
                    (profile.documentOf(type)?.isApproved ?? false)
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    size: TamamSize.iconSm,
                    color: (profile.documentOf(type)?.isApproved ?? false) ? colors.success : colors.textTertiary,
                  ),
                  const SizedBox(width: TamamSpacing.s2),
                  Expanded(
                    child: Text(
                      JobLabels.documentType(l10n, type),
                      style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: TamamSpacing.s2),
          Text(
            l10n.onboardingSubmittedOn(units.dateWithYear(profile.createdAt)),
            style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }
}
