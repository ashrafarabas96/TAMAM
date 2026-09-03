import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/jobs/presentation/widgets/job_card.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// "مشاويري" — the partner's history, filtered by outcome and optionally by
/// a date range.
class JobsScreen extends ConsumerStatefulWidget {
  const JobsScreen({super.key});

  @override
  ConsumerState<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends ConsumerState<JobsScreen> {
  JobHistoryFilter _filter = const JobHistoryFilter();

  Future<void> _pickRange() async {
    final DateTime now = DateTime.now();
    final DateTimeRange? range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange: _filter.from == null || _filter.to == null
          ? null
          : DateTimeRange(start: _filter.from!, end: _filter.to!),
    );
    if (range == null) return;
    setState(() => _filter = _filter.copyWith(from: range.start, to: range.end));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.jobsTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.jobsFilterByDate,
            onPressed: () => unawaited(_pickRange()),
            icon: Icon(_filter.hasDateRange ? Icons.event_available_rounded : Icons.date_range_rounded),
          ),
          if (_filter.hasDateRange)
            IconButton(
              tooltip: l10n.actionClear,
              onPressed: () => setState(() => _filter = _filter.copyWith(clearDates: true)),
              icon: const Icon(Icons.close_rounded),
            ),
        ],
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s3, TamamSpacing.s4, TamamSpacing.s1),
            child: Row(
              children: <Widget>[
                for (final JobStatusGroup group in <JobStatusGroup>[
                  JobStatusGroup.completed,
                  JobStatusGroup.cancelled,
                  JobStatusGroup.all,
                ])
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: TamamSpacing.s2),
                    child: ChoiceChip(
                      label: Text(_groupLabel(l10n, group)),
                      selected: _filter.group == group,
                      onSelected: (bool _) => setState(() => _filter = _filter.copyWith(group: group)),
                    ),
                  ),
              ],
            ),
          ),
          if (_filter.hasDateRange)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4, vertical: TamamSpacing.s1),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  '${units.dateWithYear(_filter.from!)} — ${units.dateWithYear(_filter.to!)}',
                  style: TamamType.labelMd.toTextStyle(color: colors.textSecondary),
                ),
              ),
            ),
          Expanded(
            child: AsyncView<CursorPage<Job>>(
              value: ref.watch(jobHistoryProvider(_filter)),
              onRetry: () => ref.invalidate(jobHistoryProvider(_filter)),
              isEmpty: (CursorPage<Job> page) => page.items.isEmpty,
              emptyTitle: l10n.jobsEmptyTitle,
              emptyMessage: l10n.jobsEmptyBody,
              emptyIcon: Icons.receipt_long_outlined,
              builder: (CursorPage<Job> page) => RefreshIndicator(
                color: colors.primary,
                onRefresh: () async => ref.invalidate(jobHistoryProvider(_filter)),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    TamamSpacing.s4,
                    TamamSpacing.s3,
                    TamamSpacing.s4,
                    TamamSpacing.s8,
                  ),
                  itemCount: page.items.length + (page.hasMore ? 1 : 0),
                  itemBuilder: (BuildContext context, int index) {
                    if (index >= page.items.length) {
                      return Center(
                        child: TextButton(
                          onPressed: () => unawaited(ref.read(jobHistoryProvider(_filter).notifier).loadMore()),
                          child: Text(l10n.actionLoadMore),
                        ),
                      );
                    }
                    final Job job = page.items[index];
                    return JobCard(
                      job: job,
                      onTap: () => context.push(
                        job.isActiveForPartner ? Routes.activeJob(job.id) : Routes.job(job.id),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _groupLabel(AppLocalizations l10n, JobStatusGroup group) {
    switch (group) {
      case JobStatusGroup.active:
        return l10n.jobsFilterActive;
      case JobStatusGroup.completed:
        return l10n.jobsFilterCompleted;
      case JobStatusGroup.cancelled:
        return l10n.jobsFilterCancelled;
      case JobStatusGroup.all:
        return l10n.jobsFilterAll;
    }
  }
}
