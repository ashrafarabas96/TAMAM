import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The persistent strip above the bottom nav while a job is in progress.
///
/// It is deliberately loud (purple, full width, always tappable): a partner
/// who wanders into another tab must be one tap from the job they are on.
class ActiveJobBanner extends ConsumerWidget {
  const ActiveJobBanner({required this.job, super.key});

  final Job job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final int? eta = job.hasStarted ? job.etaToDestinationSeconds : job.etaToPickupSeconds;

    return Semantics(
      button: true,
      label: l10n.activeJobBannerSemantics(JobLabels.status(l10n, job.status)),
      child: Material(
        color: colors.surfaceBrand,
        child: InkWell(
          onTap: () => context.push(Routes.activeJob(job.id)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4, vertical: TamamSpacing.s3),
            child: Row(
              children: <Widget>[
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: TamamBrand.purple700, shape: BoxShape.circle),
                  child: Icon(JobLabels.typeIcon(job.type), size: TamamSize.iconMd, color: colors.accent),
                ),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        JobLabels.status(l10n, job.status),
                        style: TamamType.labelLg.toTextStyle(color: colors.textOnBrand),
                      ),
                      Text(
                        job.currentTarget?.address.formatted ?? job.number,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
                      ),
                    ],
                  ),
                ),
                if (eta != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: 2),
                    decoration: BoxDecoration(
                      color: colors.accent,
                      borderRadius: BorderRadius.circular(TamamRadius.pill),
                    ),
                    child: Text(
                      l10n.durationMin(units.minutesValue(eta)),
                      style: TamamType.labelSm.toTextStyle(color: colors.textOnAccent),
                    ),
                  ),
                const SizedBox(width: TamamSpacing.s2),
                Icon(Icons.chevron_right_rounded, color: colors.textOnBrand),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
