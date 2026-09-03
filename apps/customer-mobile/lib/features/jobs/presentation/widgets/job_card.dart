import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/directional_chevron.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// One order row in "طلباتي" and in the recent-orders strip on home.
class JobCard extends ConsumerWidget {
  const JobCard({required this.job, required this.onTap, super.key, this.trailing});

  final Job job;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final Color accent = serviceColorFor(job.type);
    final String title = JobLabels.jobType(l10n, job.type);
    final String? where = job.destination?.address.formatted ?? job.pickup?.address.formatted;

    return TamamCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
      semanticLabel: '$title. ${JobLabels.status(l10n, job.status)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(TamamRadius.sm),
                ),
                child: Icon(_iconFor(job.type), size: TamamSize.iconMd, color: accent),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      title,
                      style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                    ),
                    Text(
                      '${job.number} · ${units.dateTime(job.createdAt)}',
                      style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                    ),
                  ],
                ),
              ),
              StatusPill.forJobStatus(
                status: job.status,
                label: JobLabels.status(l10n, job.status),
              ),
            ],
          ),
          if (where != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            Row(
              children: <Widget>[
                Icon(Icons.place_outlined, size: TamamSize.iconSm, color: colors.textTertiary),
                const SizedBox(width: TamamSpacing.s1),
                Expanded(
                  child: Text(
                    where,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              if (job.displayTotal != null)
                MoneyText(job.displayTotal!, emphasis: MoneyEmphasis.medium)
              else
                Text(
                  l10n.jobPricePending,
                  style: TamamType.labelMd.toTextStyle(color: colors.textTertiary),
                ),
              const Spacer(),
              if (trailing != null)
                trailing!
              else
                Text(
                  JobLabels.paymentMethod(l10n, job.paymentMethod),
                  style: TamamType.labelMd.toTextStyle(color: colors.textSecondary),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static IconData _iconFor(JobType type) {
    switch (type) {
      case JobType.ride:
        return Icons.local_taxi_rounded;
      case JobType.delivery:
        return Icons.inventory_2_rounded;
      case JobType.homeService:
        return Icons.handyman_rounded;
      case JobType.food:
      case JobType.grocery:
      case JobType.pharmacy:
      case JobType.shopping:
      case JobType.moving:
      case JobType.roadAssistance:
        return Icons.bolt_rounded;
    }
  }
}

/// The pinned card at the top of home while a job is running.
class ActiveJobBanner extends ConsumerWidget {
  const ActiveJobBanner({required this.job, required this.onTap, super.key});

  final Job job;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final int? etaSeconds = job.etaToPickupSeconds ?? job.etaToDestinationSeconds;

    return TamamCard(
      onTap: onTap,
      background: colors.surfaceBrand,
      margin: const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s4, TamamSpacing.s4, 0),
      semanticLabel: l10n.homeActiveJob,
      child: Row(
        children: <Widget>[
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: colors.accent,
              borderRadius: BorderRadius.circular(TamamRadius.sm),
            ),
            child: Icon(
              JobCard._iconFor(job.type),
              size: TamamSize.iconMd,
              color: colors.textOnAccent,
            ),
          ),
          const SizedBox(width: TamamSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  JobLabels.status(l10n, job.status),
                  style: TamamType.headingSm.toTextStyle(color: colors.textOnBrand),
                ),
                Text(
                  job.partner?.fullName ?? l10n.homeSearchingPartner,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
                ),
              ],
            ),
          ),
          if (etaSeconds != null && etaSeconds > 0)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Text(
                  units.minutesValue(etaSeconds),
                  style: TamamType.headingMd.toTextStyle(color: colors.accent),
                ),
                Text(
                  l10n.unitMinutes,
                  style: TamamType.labelSm.toTextStyle(color: TamamBrand.purple100),
                ),
              ],
            ),
          const SizedBox(width: TamamSpacing.s2),
          DirectionalChevron(color: colors.textOnBrand),
        ],
      ),
    );
  }
}
