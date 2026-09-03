import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// One required document: its review status, expiry and — when the review team
/// rejected it — the exact reason, so a partner knows what to re-upload.
class DocumentTile extends ConsumerWidget {
  const DocumentTile({
    required this.type,
    required this.document,
    required this.onUpload,
    super.key,
    this.required = true,
  });

  final DocumentType type;

  /// `null` when nothing has been uploaded for [type] yet.
  final PartnerDocument? document;
  final VoidCallback onUpload;
  final bool required;

  static String statusLabel(AppLocalizations l10n, DocumentStatus status) {
    switch (status) {
      case DocumentStatus.pending:
        return l10n.documentStatusPending;
      case DocumentStatus.approved:
        return l10n.documentStatusApproved;
      case DocumentStatus.rejected:
        return l10n.documentStatusRejected;
      case DocumentStatus.expired:
        return l10n.documentStatusExpired;
    }
  }

  static PillTone statusTone(DocumentStatus status) {
    switch (status) {
      case DocumentStatus.approved:
        return PillTone.success;
      case DocumentStatus.rejected:
      case DocumentStatus.expired:
        return PillTone.danger;
      case DocumentStatus.pending:
        return PillTone.warning;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final PartnerDocument? doc = document;
    final bool needsAction = doc == null || doc.needsAction;

    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
      onTap: onUpload,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: needsAction ? colors.warningSoft : colors.successSoft,
                  borderRadius: BorderRadius.circular(TamamRadius.sm),
                ),
                child: Icon(
                  needsAction ? Icons.upload_file_rounded : Icons.description_rounded,
                  color: needsAction ? colors.warning : colors.success,
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            JobLabels.documentType(l10n, type),
                            style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                          ),
                        ),
                        if (required) ...<Widget>[
                          const SizedBox(width: TamamSpacing.s1),
                          Text('*', style: TamamType.labelLg.toTextStyle(color: colors.danger)),
                        ],
                      ],
                    ),
                    if (doc == null)
                      Text(l10n.documentNotUploaded, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary))
                    else ...<Widget>[
                      if (doc.number != null && doc.number!.isNotEmpty)
                        Text(
                          doc.number!,
                          textDirection: TextDirection.ltr,
                          style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                        ),
                      if (doc.expiresAt != null)
                        Text(
                          l10n.documentExpiresOn(units.dateWithYear(doc.expiresAt!)),
                          style: TamamType.bodySm.toTextStyle(
                            color: doc.isExpired
                                ? colors.danger
                                : doc.isExpiringSoon
                                    ? colors.warning
                                    : colors.textTertiary,
                          ),
                        ),
                    ],
                  ],
                ),
              ),
              if (doc != null) StatusPill(label: statusLabel(l10n, doc.status), tone: statusTone(doc.status), dense: true),
            ],
          ),
          if (doc != null && doc.isRejected && doc.rejectionReason != null)
            Container(
              margin: const EdgeInsets.only(top: TamamSpacing.s2),
              padding: const EdgeInsets.all(TamamSpacing.s2),
              decoration: BoxDecoration(color: colors.dangerSoft, borderRadius: BorderRadius.circular(TamamRadius.sm)),
              child: Text(
                l10n.documentRejectionReason(doc.rejectionReason!),
                style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong),
              ),
            ),
          if (needsAction)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: onUpload,
                icon: const Icon(Icons.file_upload_outlined, size: TamamSize.iconSm),
                label: Text(doc == null ? l10n.documentUpload : l10n.documentReupload),
              ),
            ),
        ],
      ),
    );
  }
}
