import 'package:flutter/material.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';

/// Semantic tone of a pill.
enum PillTone { neutral, brand, success, warning, danger, info }

/// A small pill-shaped label — job status, urgency, payment method, badges.
class StatusPill extends StatelessWidget {
  const StatusPill({
    required this.label,
    super.key,
    this.tone = PillTone.neutral,
    this.icon,
    this.dense = false,
  });

  /// Chooses the tone that matches a job status so every list agrees.
  factory StatusPill.forJobStatus({required JobStatus status, required String label, Key? key}) =>
      StatusPill(key: key, label: label, tone: toneForJobStatus(status));

  final String label;
  final PillTone tone;
  final IconData? icon;
  final bool dense;

  static PillTone toneForJobStatus(JobStatus status) {
    switch (status) {
      case JobStatus.completed:
      case JobStatus.customerConfirmed:
      case JobStatus.workCompleted:
        return PillTone.success;
      case JobStatus.cancelled:
      case JobStatus.noPartnerAvailable:
      case JobStatus.disputed:
      case JobStatus.quoteRejected:
        return PillTone.danger;
      case JobStatus.draft:
        return PillTone.neutral;
      case JobStatus.requested:
      case JobStatus.searching:
      case JobStatus.quoteRequired:
      case JobStatus.quoteSubmitted:
      case JobStatus.waitingForParts:
      case JobStatus.waitingCustomer:
        return PillTone.warning;
      case JobStatus.assigned:
      case JobStatus.partnerEnRoute:
      case JobStatus.partnerArrived:
      case JobStatus.inProgress:
      case JobStatus.inspectionStarted:
      case JobStatus.quoteApproved:
      case JobStatus.workStarted:
        return PillTone.brand;
    }
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final (Color background, Color foreground) = switch (tone) {
      PillTone.neutral => (colors.surfaceAlt, colors.textSecondary),
      PillTone.brand => (colors.surfaceBrandSoft, colors.primary),
      PillTone.success => (colors.successSoft, TamamSemantic.successStrong),
      PillTone.warning => (colors.warningSoft, TamamSemantic.warningStrong),
      PillTone.danger => (colors.dangerSoft, TamamSemantic.dangerStrong),
      PillTone.info => (colors.infoSoft, TamamSemantic.infoStrong),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? TamamSpacing.s2 : TamamSpacing.s3,
        vertical: dense ? 2 : TamamSpacing.s1,
      ),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(TamamRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: TamamSize.iconSm, color: foreground),
            const SizedBox(width: TamamSpacing.s1),
          ],
          Text(
            label,
            style: (dense ? TamamType.labelSm : TamamType.labelMd).toTextStyle(color: foreground),
          ),
        ],
      ),
    );
  }
}
