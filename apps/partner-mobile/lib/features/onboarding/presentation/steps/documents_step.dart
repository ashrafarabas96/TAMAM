import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_tile.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_upload_sheet.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 4: every document the chosen roles and categories require.
///
/// The required set is the union of the role defaults and each selected
/// category's `requiredDocumentTypes`, so a gas technician is asked for their
/// certificate without the app hard-coding trade rules.
class DocumentsStep extends ConsumerWidget {
  const DocumentsStep({required this.state, super.key});

  final OnboardingState state;

  List<DocumentType> _requiredTypes(List<ServiceCategory> categories) {
    final PartnerProfile? profile = state.profile;
    final Set<DocumentType> types = OnboardingFlow.requiredDocuments(state.roles).toSet();
    final Set<String> chosen = profile?.categoryIds.toSet() ?? const <String>{};
    for (final ServiceCategory category in categories) {
      if (chosen.contains(category.id)) types.addAll(category.requiredDocumentTypes);
    }
    return types.toList(growable: false);
  }

  Future<void> _upload(BuildContext context, WidgetRef ref, DocumentType type) async {
    final DocumentUploadResult? result = await DocumentUploadSheet.show(context, type: type);
    if (result == null) return;
    await ref.read(onboardingProvider.notifier).addDocument(
          type: result.type,
          mediaId: result.mediaId,
          number: result.number,
          issuedAt: result.issuedAt,
          expiresAt: result.expiresAt,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final PartnerProfile? profile = state.profile;
    final List<ServiceCategory> categories = ref.watch(serviceCategoriesProvider).valueOrNull ?? const <ServiceCategory>[];
    final List<DocumentType> required = _requiredTypes(categories);
    final bool complete = required.every((DocumentType type) {
      final PartnerDocument? doc = profile?.documentOf(type);
      return doc != null && !doc.needsAction;
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingDocumentsHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s4),
        for (final DocumentType type in required)
          DocumentTile(
            type: type,
            document: profile?.documentOf(type),
            onUpload: () => unawaited(_upload(context, ref, type)),
          ),
        if (state.failure != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s2),
          Text(localizedFailure(l10n, state.failure!), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
        ],
        const SizedBox(height: TamamSpacing.s4),
        Text(
          complete ? l10n.onboardingDocumentsComplete : l10n.onboardingDocumentsPending,
          style: TamamType.bodySm.toTextStyle(color: complete ? colors.success : colors.textTertiary),
        ),
        const SizedBox(height: TamamSpacing.s4),
        TamamButton(
          label: l10n.actionNext,
          busy: state.busy,
          onPressed: complete ? () => ref.read(onboardingProvider.notifier).advanceFromDocuments() : null,
        ),
      ],
    );
  }
}
