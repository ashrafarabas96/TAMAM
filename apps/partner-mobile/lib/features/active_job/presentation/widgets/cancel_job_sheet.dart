import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// What the partner chose in the cancel sheet.
class CancelDecision {
  const CancelDecision({required this.reason, this.text});

  final PartnerCancelReason reason;
  final String? text;
}

/// Cancel with a reason. No-show / unreachable are only offered once the
/// partner has arrived, and the server still enforces its waiting timeout:
/// [noShowBlockedMessage] carries its refusal so the option greys out with an
/// explanation instead of failing twice.
class CancelJobSheet extends StatefulWidget {
  const CancelJobSheet({required this.arrived, super.key, this.noShowBlockedMessage});

  final bool arrived;
  final String? noShowBlockedMessage;

  static Future<CancelDecision?> show(BuildContext context, {required bool arrived, String? noShowBlockedMessage}) =>
      SheetScaffold.show<CancelDecision>(
        context,
        (BuildContext _) => CancelJobSheet(arrived: arrived, noShowBlockedMessage: noShowBlockedMessage),
      );

  @override
  State<CancelJobSheet> createState() => _CancelJobSheetState();
}

class _CancelJobSheetState extends State<CancelJobSheet> {
  final TextEditingController _text = TextEditingController();
  PartnerCancelReason? _reason;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  bool _enabled(PartnerCancelReason reason) {
    if (!reason.requiresWaitingTimeout) return true;
    return widget.arrived && widget.noShowBlockedMessage == null;
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool needsText = _reason == PartnerCancelReason.other;
    final bool valid = _reason != null && (!needsText || _text.text.trim().length >= 3);

    return SheetScaffold(
      title: l10n.cancelJobTitle,
      subtitle: l10n.cancelJobSubtitle,
      footer: TamamButton(
        label: l10n.cancelJobConfirm,
        variant: TamamButtonVariant.danger,
        onPressed: valid
            ? () => Navigator.of(context).pop(CancelDecision(reason: _reason!, text: _text.text.trim()))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (widget.noShowBlockedMessage != null)
            Container(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
              padding: const EdgeInsets.all(TamamSpacing.s3),
              decoration: BoxDecoration(color: colors.warningSoft, borderRadius: BorderRadius.circular(TamamRadius.md)),
              child: Text(
                widget.noShowBlockedMessage!,
                style: TamamType.bodySm.toTextStyle(color: TamamSemantic.warningStrong),
              ),
            )
          else if (!widget.arrived)
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s3),
              child: Text(l10n.cancelJobNoShowAfterArrival, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
            ),
          for (final PartnerCancelReason reason in PartnerCancelReason.values)
            RadioListTile<PartnerCancelReason>(
              value: reason,
              groupValue: _reason,
              contentPadding: EdgeInsets.zero,
              title: Text(JobLabels.cancelReason(l10n, reason)),
              onChanged: _enabled(reason) ? (PartnerCancelReason? value) => setState(() => _reason = value) : null,
            ),
          const SizedBox(height: TamamSpacing.s2),
          TextField(
            controller: _text,
            maxLines: 3,
            maxLength: 500,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(
              labelText: needsText ? l10n.cancelJobReasonRequired : l10n.cancelJobReasonOptional,
              alignLabelWithHint: true,
              counterText: '',
            ),
          ),
        ],
      ),
    );
  }
}

/// Release the job back to dispatch (allowed before the work starts).
class ReleaseJobSheet extends StatefulWidget {
  const ReleaseJobSheet({super.key});

  static Future<String?> show(BuildContext context) =>
      SheetScaffold.show<String>(context, (BuildContext _) => const ReleaseJobSheet());

  @override
  State<ReleaseJobSheet> createState() => _ReleaseJobSheetState();
}

class _ReleaseJobSheetState extends State<ReleaseJobSheet> {
  final TextEditingController _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final bool valid = _text.text.trim().length >= 3;
    return SheetScaffold(
      title: l10n.releaseJobTitle,
      subtitle: l10n.releaseJobSubtitle,
      footer: TamamButton(
        label: l10n.releaseJobConfirm,
        variant: TamamButtonVariant.danger,
        onPressed: valid ? () => Navigator.of(context).pop(_text.text.trim()) : null,
      ),
      child: TextField(
        controller: _text,
        autofocus: true,
        maxLines: 3,
        maxLength: 300,
        onChanged: (String _) => setState(() {}),
        decoration: InputDecoration(labelText: l10n.releaseJobReason, alignLabelWithHint: true, counterText: ''),
      ),
    );
  }
}
