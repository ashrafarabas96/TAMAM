import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// One row of the history list: what it was, when, and what it paid.
class JobCard extends ConsumerWidget {
  const JobCard({required this.job, required this.onTap, super.key});

  final Job job;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
      onTap: onTap,
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
                  color: JobLabels.typeColor(job.type).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(TamamRadius.sm),
                ),
                child: Icon(JobLabels.typeIcon(job.type), color: JobLabels.typeColor(job.type)),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      JobLabels.type(l10n, job.type),
                      style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                    ),
                    Text(
                      '${job.number} · ${units.dateTime(job.completedAt ?? job.createdAt)}',
                      textDirection: TextDirection.ltr,
                      style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  if (job.partnerEarnings != null)
                    MoneyText(job.partnerEarnings!, emphasis: MoneyEmphasis.medium)
                  else if (job.displayTotal != null)
                    MoneyText(job.displayTotal!, emphasis: MoneyEmphasis.subtle),
                  StatusPill.forJobStatus(status: job.status, label: JobLabels.status(l10n, job.status)),
                ],
              ),
            ],
          ),
          if (job.currentTarget != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Row(
              children: <Widget>[
                Icon(Icons.place_outlined, size: TamamSize.iconSm, color: colors.textTertiary),
                const SizedBox(width: TamamSpacing.s1),
                Expanded(
                  child: Text(
                    job.currentTarget!.address.formatted,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                  ),
                ),
                if (job.distanceMeters != null)
                  Text(
                    units.isKilometres(job.distanceMeters!)
                        ? l10n.distanceKm(units.distanceValue(job.distanceMeters!))
                        : l10n.distanceM(units.distanceValue(job.distanceMeters!)),
                    style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
