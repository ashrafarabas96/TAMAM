import 'package:flutter/material.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// A compact horizontal progress spine for the job lifecycle.
///
/// Ride/delivery and home-service jobs have different milestones, so the steps
/// come from [JobLabels.stepperFor]. Statuses that sit off the spine (cancelled,
/// waiting for parts) collapse to a single explanatory row instead.
class JobStatusStepper extends StatelessWidget {
  const JobStatusStepper({required this.type, required this.status, super.key});

  final JobType type;
  final JobStatus status;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<JobStatus> steps = JobLabels.stepperFor(type);
    final int current = JobLabels.stepIndex(type, status);

    if (current < 0) {
      return Row(
        children: <Widget>[
          Icon(Icons.info_outline_rounded, size: TamamSize.iconMd, color: colors.textSecondary),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(
            child: Text(
              JobLabels.status(l10n, status),
              style: TamamType.labelLg.toTextStyle(color: colors.textPrimary),
            ),
          ),
        ],
      );
    }

    return Semantics(
      label: l10n.trackingProgressLabel(current + 1, steps.length, JobLabels.status(l10n, status)),
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                for (int i = 0; i < steps.length; i++) ...<Widget>[
                  if (i > 0)
                    Expanded(
                      child: Container(
                        height: 3,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: i <= current ? colors.primary : colors.border,
                          borderRadius: BorderRadius.circular(TamamRadius.pill),
                        ),
                      ),
                    ),
                  _Dot(done: i < current, active: i == current, colors: colors),
                ],
              ],
            ),
            const SizedBox(height: TamamSpacing.s3),
            Text(
              JobLabels.status(l10n, status),
              style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.done, required this.active, required this.colors});

  final bool done;
  final bool active;
  final TamamColors colors;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: TamamMotion.durationBase,
        width: active ? 14 : 10,
        height: active ? 14 : 10,
        decoration: BoxDecoration(
          color: done || active ? colors.primary : colors.border,
          shape: BoxShape.circle,
          border: active ? Border.all(color: colors.surfaceBrandSoft, width: 3) : null,
        ),
      );
}
