import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/features/account/data/partner_repository.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_tile.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_upload_sheet.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Every document on file, with expiry badges and re-upload.
///
/// The same sheet as onboarding is used, so a renewal is exactly the flow the
/// partner already knows.
class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  Future<void> _upload(BuildContext context, WidgetRef ref, DocumentType type) async {
    final DocumentUploadResult? result = await DocumentUploadSheet.show(context, type: type);
    if (result == null) return;
    try {
      await ref.read(partnerRepositoryProvider).addDocument(
            type: result.type,
            mediaId: result.mediaId,
            number: result.number,
            issuedAt: result.issuedAt,
            expiresAt: result.expiresAt,
          );
      ref
        ..invalidate(partnerProfileProvider)
        ..invalidate(partnerDocumentsProvider);
      if (context.mounted) {
        AppFeedback.showMessage(context, context.l10n.documentUploaded, icon: Icons.check_rounded);
      }
    } on AppFailure catch (failure) {
      if (context.mounted) AppFeedback.showFailure(context, failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<ServiceCategory> categories = ref.watch(serviceCategoriesProvider).valueOrNull ?? const <ServiceCategory>[];

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.documentsTitle)),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: AsyncView<PartnerProfile>(
              value: ref.watch(partnerProfileProvider),
              onRetry: () => ref.invalidate(partnerProfileProvider),
              builder: (PartnerProfile profile) {
                final Set<DocumentType> required = OnboardingFlow.requiredDocuments(profile.roles).toSet();
                for (final ServiceCategory category in categories) {
                  if (profile.categoryIds.contains(category.id)) required.addAll(category.requiredDocumentTypes);
                }
                // Anything already on file that is no longer required still
                // has to be visible, or a partner cannot see why it was flagged.
                final Set<DocumentType> extra =
                    profile.documents.map((PartnerDocument d) => d.type).toSet().difference(required);

                return RefreshIndicator(
                  color: colors.primary,
                  onRefresh: () async => ref.invalidate(partnerProfileProvider),
                  child: ListView(
                    padding: const EdgeInsets.all(TamamSpacing.s4),
                    children: <Widget>[
                      if (profile.blockingDocuments.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
                          padding: const EdgeInsets.all(TamamSpacing.s3),
                          decoration: BoxDecoration(
                            color: colors.dangerSoft,
                            borderRadius: BorderRadius.circular(TamamRadius.md),
                          ),
                          child: Row(
                            children: <Widget>[
                              Icon(Icons.gpp_bad_rounded, color: colors.danger),
                              const SizedBox(width: TamamSpacing.s2),
                              Expanded(
                                child: Text(
                                  l10n.documentsBlockingWarning,
                                  style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong),
                                ),
                              ),
                            ],
                          ),
                        ),
                      Text(l10n.documentsRequired, style: TamamType.labelMd.toTextStyle(color: colors.textTertiary)),
                      const SizedBox(height: TamamSpacing.s2),
                      for (final DocumentType type in required)
                        DocumentTile(
                          type: type,
                          document: profile.documentOf(type),
                          onUpload: () => unawaited(_upload(context, ref, type)),
                        ),
                      if (extra.isNotEmpty) ...<Widget>[
                        const SizedBox(height: TamamSpacing.s4),
                        Text(l10n.documentsOther, style: TamamType.labelMd.toTextStyle(color: colors.textTertiary)),
                        const SizedBox(height: TamamSpacing.s2),
                        for (final DocumentType type in extra)
                          DocumentTile(
                            type: type,
                            document: profile.documentOf(type),
                            required: false,
                            onUpload: () => unawaited(_upload(context, ref, type)),
                          ),
                      ],
                      const SizedBox(height: TamamSpacing.s5),
                      Text(
                        l10n.documentsReviewHint,
                        style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
