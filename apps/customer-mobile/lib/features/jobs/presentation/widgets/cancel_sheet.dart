import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/job_tracking_controller.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Cancellation with a reason and a fee warning.
///
/// The exact fee is a server policy (grace window, whether the partner already
/// arrived), so the sheet warns generically and lets the API decide; the final
/// amount comes back on the job as `cancellationFee`.
class CancelJobSheet extends ConsumerStatefulWidget {
  const CancelJobSheet({required this.job, super.key});

  final Job job;

  /// Returns `true` when the job was cancelled.
  static Future<bool> show(BuildContext context, {required Job job}) async =>
      await SheetScaffold.show<bool>(context, (BuildContext _) => CancelJobSheet(job: job)) ?? false;

  @override
  ConsumerState<CancelJobSheet> createState() => _CancelJobSheetState();
}

class _CancelJobSheetState extends ConsumerState<CancelJobSheet> {
  final TextEditingController _note = TextEditingController();
  CancelReason? _reason;
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _cancel() async {
    final CancelReason? reason = _reason;
    if (reason == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).cancel(
            widget.job.id,
            reason: reason,
            version: widget.job.version,
            note: _note.text,
          );
      await ref.read(jobTrackingProvider(widget.job.id).notifier).reload();
      ref.invalidate(activeJobsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return SheetScaffold(
      title: l10n.cancelTitle,
      subtitle: l10n.cancelSubtitle,
      footer: TamamButton(
        label: l10n.cancelConfirm,
        variant: TamamButtonVariant.danger,
        busy: _busy,
        onPressed: _reason == null ? null : () => unawaited(_cancel()),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(TamamSpacing.s3),
            decoration: BoxDecoration(
              color: colors.warningSoft,
              borderRadius: BorderRadius.circular(TamamRadius.md),
            ),
            child: Row(
              children: <Widget>[
                Icon(Icons.info_outline_rounded, color: TamamSemantic.warningStrong),
                const SizedBox(width: TamamSpacing.s2),
                Expanded(
                  child: Text(
                    l10n.cancelFeeWarning,
                    style: TamamType.bodySm.toTextStyle(color: TamamSemantic.warningStrong),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s4),
          for (final CancelReason reason in CancelReason.values)
            RadioListTile<CancelReason>(
              contentPadding: EdgeInsets.zero,
              value: reason,
              groupValue: _reason,
              title: Text(JobLabels.cancelReason(l10n, reason)),
              onChanged: (CancelReason? value) => setState(() => _reason = value),
            ),
          if (_reason == CancelReason.other) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            TextField(
              controller: _note,
              maxLines: 2,
              decoration: InputDecoration(labelText: l10n.cancelNote),
            ),
          ],
        ],
      ),
    );
  }
}
