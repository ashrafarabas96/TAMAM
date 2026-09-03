import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/rating_stars.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/quotes/presentation/quote_providers.dart';
import 'package:tamam_partner/features/quotes/presentation/widgets/quote_summary_card.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// A finished job: what happened, what it paid and how the customer rated it.
class JobDetailScreen extends ConsumerWidget {
  const JobDetailScreen({required this.jobId, super.key});

  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final String language = Localizations.localeOf(context).languageCode;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.jobDetailTitle)),
      body: AsyncView<Job>(
        value: ref.watch(jobProvider(jobId)),
        onRetry: () => ref.invalidate(jobProvider(jobId)),
        builder: (Job job) => ListView(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          children: <Widget>[
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(JobLabels.typeIcon(job.type), color: JobLabels.typeColor(job.type)),
                      const SizedBox(width: TamamSpacing.s2),
                      Expanded(
                        child: Text(
                          JobLabels.type(l10n, job.type),
                          style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                        ),
                      ),
                      StatusPill.forJobStatus(status: job.status, label: JobLabels.status(l10n, job.status)),
                    ],
                  ),
                  const SizedBox(height: TamamSpacing.s1),
                  Text(
                    '${job.number} · ${units.dateTime(job.completedAt ?? job.createdAt)}',
                    textDirection: TextDirection.ltr,
                    style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                  ),
                  const SizedBox(height: TamamSpacing.s3),
                  for (final JobStop stop in job.stops)
                    Padding(
                      padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Icon(
                            stop.kind == JobStopKind.dropoff ? Icons.place_rounded : Icons.trip_origin_rounded,
                            size: TamamSize.iconSm,
                            color: colors.textTertiary,
                          ),
                          const SizedBox(width: TamamSpacing.s2),
                          Expanded(
                            child: Text(
                              stop.address.formatted,
                              style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (job.distanceMeters != null || job.durationSeconds != null)
                    Row(
                      children: <Widget>[
                        if (job.distanceMeters != null)
                          StatusPill(
                            icon: Icons.route_rounded,
                            label: units.isKilometres(job.distanceMeters!)
                                ? l10n.distanceKm(units.distanceValue(job.distanceMeters!))
                                : l10n.distanceM(units.distanceValue(job.distanceMeters!)),
                            dense: true,
                          ),
                        if (job.durationSeconds != null) ...<Widget>[
                          const SizedBox(width: TamamSpacing.s2),
                          StatusPill(
                            icon: Icons.schedule_rounded,
                            label: l10n.durationMin(units.minutesValue(job.durationSeconds!)),
                            dense: true,
                          ),
                        ],
                      ],
                    ),
                  if (job.isCancelled && job.cancellationReason != null) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s2),
                    Text(
                      l10n.jobCancelledReason(job.cancellationReason!),
                      style: TamamType.bodySm.toTextStyle(color: colors.danger),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(l10n.jobEarningsBreakdown, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
                  const SizedBox(height: TamamSpacing.s2),
                  if (job.breakdown.isEmpty)
                    Text(l10n.jobNoBreakdown, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary))
                  else
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
                        Expanded(
                          child: Text(l10n.jobTotalCharged, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
                        ),
                        MoneyText(job.displayTotal!, emphasis: MoneyEmphasis.subtle),
                      ],
                    ),
                  ],
                  if (job.partnerEarnings != null) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s2),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            l10n.completionYourEarnings,
                            style: TamamType.labelLg.toTextStyle(color: colors.textPrimary),
                          ),
                        ),
                        MoneyText(job.partnerEarnings!),
                      ],
                    ),
                  ],
                  const SizedBox(height: TamamSpacing.s2),
                  Row(
                    children: <Widget>[
                      Icon(Icons.payments_outlined, size: TamamSize.iconSm, color: colors.textTertiary),
                      const SizedBox(width: TamamSpacing.s1),
                      Text(
                        JobLabels.payment(l10n, job.paymentMethod),
                        style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (job.isHomeService) _QuotesSection(jobId: jobId),
            const SizedBox(height: TamamSpacing.s3),
            _RatingSection(jobId: jobId, job: job),
            const SizedBox(height: TamamSpacing.s3),
            TamamButton(
              label: l10n.jobReportProblem,
              variant: TamamButtonVariant.outline,
              icon: Icons.support_agent_rounded,
              onPressed: () => context.push('${Routes.support}?jobId=$jobId'),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuotesSection extends ConsumerWidget {
  const _QuotesSection({required this.jobId});

  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<Quote> quotes = ref.watch(jobQuotesProvider(jobId)).valueOrNull ?? const <Quote>[];
    if (quotes.isEmpty) return const SizedBox.shrink();
    return Column(
      children: <Widget>[
        for (final Quote quote in quotes)
          Padding(
            padding: const EdgeInsets.only(top: TamamSpacing.s3),
            child: QuoteSummaryCard(quote: quote, expanded: true),
          ),
      ],
    );
  }
}

class _RatingSection extends ConsumerWidget {
  const _RatingSection({required this.jobId, required this.job});

  final String jobId;
  final Job job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final JobRating? rating = ref.watch(myJobRatingProvider(jobId)).valueOrNull;

    return TamamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.jobRatingTitle, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
          const SizedBox(height: TamamSpacing.s2),
          if (rating == null)
            if (job.canRateCustomer)
              TamamButton(
                label: l10n.completionRateCustomer,
                variant: TamamButtonVariant.secondary,
                icon: Icons.star_rounded,
                onPressed: () => context.push(Routes.rateCustomer(jobId)),
              )
            else
              Text(l10n.jobRatingUnavailable, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary))
          else ...<Widget>[
            RatingBadge(rating: rating.rating.toDouble(), compact: false),
            if (rating.comment != null && rating.comment!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: TamamSpacing.s1),
                child: Text(rating.comment!, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
              ),
          ],
        ],
      ),
    );
  }
}
