import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/localized_text.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/media/presentation/widgets/attachment_picker.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Shown once after a successful completion: what the partner earned.
///
/// Numbers come straight from the job's server-computed breakdown; the sheet
/// adds nothing up.
class CompletionSummarySheet extends StatelessWidget {
  const CompletionSummarySheet({required this.job, super.key});

  final Job job;

  static Future<void> show(BuildContext context, {required Job job}) =>
      SheetScaffold.show<void>(context, (BuildContext _) => CompletionSummarySheet(job: job), dismissible: false);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;
    final Money? earnings = job.partnerEarnings;
    final bool awaitingCustomer = job.awaitsCustomerConfirmation;

    return SheetScaffold(
      title: awaitingCustomer ? l10n.completionAwaitingTitle : l10n.completionTitle,
      subtitle: awaitingCustomer ? l10n.completionAwaitingSubtitle : l10n.completionSubtitle(job.number),
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (job.canRateCustomer)
            TamamButton(
              label: l10n.completionRateCustomer,
              icon: Icons.star_rounded,
              onPressed: () {
                Navigator.of(context).pop();
                context.pushReplacement(Routes.rateCustomer(job.id));
              },
            ),
          const SizedBox(height: TamamSpacing.s2),
          TamamButton(
            label: l10n.completionBackHome,
            variant: TamamButtonVariant.ghost,
            onPressed: () {
              Navigator.of(context).pop();
              context.go(Routes.home);
            },
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: colors.successSoft, shape: BoxShape.circle),
            child: Icon(
              awaitingCustomer ? Icons.hourglass_top_rounded : Icons.check_rounded,
              color: colors.success,
              size: 36,
            ),
          ),
          const SizedBox(height: TamamSpacing.s4),
          if (earnings != null) ...<Widget>[
            Text(
              l10n.completionYourEarnings,
              textAlign: TextAlign.center,
              style: TamamType.labelMd.toTextStyle(color: colors.textSecondary),
            ),
            Center(child: MoneyText(earnings, style: const TextStyle(fontSize: 34))),
            const SizedBox(height: TamamSpacing.s3),
          ],
          for (final FareBreakdownLine line in job.breakdown)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      line.label.resolve(language),
                      style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                    ),
                  ),
                  MoneyText(
                    line.isDeduction && !line.amount.isNegative
                        ? Money(amount: -line.amount.amount, currency: line.amount.currency)
                        : line.amount,
                    emphasis: MoneyEmphasis.subtle,
                    signed: line.isDeduction,
                  ),
                ],
              ),
            ),
          if (job.displayTotal != null) ...<Widget>[
            Divider(color: colors.border),
            Row(
              children: <Widget>[
                Expanded(child: Text(l10n.jobTotalCharged, style: TamamType.labelLg.toTextStyle(color: colors.textPrimary))),
                MoneyText(job.displayTotal!, emphasis: MoneyEmphasis.medium),
              ],
            ),
            const SizedBox(height: TamamSpacing.s1),
            Text(
              job.paymentMethod == PaymentMethod.cash ? l10n.completionCollectCash : l10n.completionPaidElectronically,
              style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
            ),
          ],
        ],
      ),
    );
  }
}

/// Before `work/complete`: completion photos (uploaded as JOB_ATTACHMENT) and
/// the confirmation. Photos are strongly encouraged, not enforced, because a
/// job must never be stuck on a broken camera.
class CompleteWorkSheet extends ConsumerStatefulWidget {
  const CompleteWorkSheet({required this.job, super.key});

  final Job job;

  /// Resolves `true` when the partner confirmed.
  static Future<bool> show(BuildContext context, {required Job job}) async =>
      await SheetScaffold.show<bool>(context, (BuildContext _) => CompleteWorkSheet(job: job)) ?? false;

  @override
  ConsumerState<CompleteWorkSheet> createState() => _CompleteWorkSheetState();
}

class _CompleteWorkSheetState extends ConsumerState<CompleteWorkSheet> {
  List<Attachment> _photos = <Attachment>[];

  Future<void> _add({required bool fromCamera}) async {
    final MediaRepository media = ref.read(mediaRepositoryProvider);
    final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: 6 - _photos.length);
    if (picked.isEmpty || !mounted) return;
    setState(() => _photos = <Attachment>[..._photos, ...picked.map((Attachment a) => a.copyWith(uploading: true))]);
    for (final Attachment attachment in picked) {
      try {
        final Attachment uploaded = await media.upload(attachment, purpose: MediaPurpose.jobAttachment);
        _replace(attachment.localPath, uploaded);
      } on Object catch (error) {
        _replace(attachment.localPath, attachment.copyWith(uploading: false, failed: true));
        if (mounted) AppFeedback.showFailure(context, asFailure(error));
      }
    }
  }

  void _replace(String path, Attachment next) {
    if (!mounted) return;
    setState(() => _photos = _photos.map((Attachment a) => a.localPath == path ? next : a).toList(growable: false));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool uploading = _photos.any((Attachment a) => a.uploading);
    final LocalizedText? category = widget.job.delivery?.packageCategoryName;

    return SheetScaffold(
      title: l10n.completeWorkTitle,
      subtitle: l10n.completeWorkSubtitle,
      footer: TamamButton(
        label: l10n.jobActionCompleteWork,
        busy: uploading,
        onPressed: uploading ? null : () => Navigator.of(context).pop(true),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          AttachmentPicker(
            attachments: _photos,
            label: l10n.completeWorkPhotos,
            hint: l10n.completeWorkPhotosHint,
            onAdd: ({required bool fromCamera}) => unawaited(_add(fromCamera: fromCamera)),
            onRemove: (String path) =>
                setState(() => _photos = _photos.where((Attachment a) => a.localPath != path).toList(growable: false)),
          ),
          const SizedBox(height: TamamSpacing.s4),
          if (widget.job.activeQuote != null)
            Row(
              children: <Widget>[
                Expanded(child: Text(l10n.completeWorkApprovedTotal, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary))),
                MoneyText(widget.job.activeQuote!.total, emphasis: MoneyEmphasis.medium),
              ],
            ),
          if (category != null)
            Text(
              category.resolve(Localizations.localeOf(context).languageCode),
              style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
            ),
          const SizedBox(height: TamamSpacing.s2),
          Text(
            l10n.completeWorkCustomerConfirms,
            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
          ),
          Text(
            JobLabels.type(l10n, widget.job.type),
            style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }
}
