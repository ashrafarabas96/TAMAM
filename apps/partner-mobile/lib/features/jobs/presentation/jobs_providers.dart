import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/session/session_state.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';

final Provider<JobsRepository> jobsRepositoryProvider =
    Provider<JobsRepository>((Ref ref) => JobsRepository(ref.watch(apiClientProvider)));

/// Jobs that occupy the partner right now (assigned → work completed).
///
/// The first one drives the persistent card in the shell. Invalidated on
/// every transition, on offer acceptance and on app resume.
final FutureProvider<List<Job>> activeJobsProvider = FutureProvider<List<Job>>((Ref ref) async {
  if (!ref.watch(sessionControllerProvider.select((SessionState s) => s.canWork))) return const <Job>[];
  final CursorPage<Job> page = await ref.watch(jobsRepositoryProvider).list(group: JobStatusGroup.active, limit: 5);
  return page.items.where((Job j) => j.isActiveForPartner).toList(growable: false);
});

/// One job by id — the detail and the active-job screen both start from it.
final FutureProviderFamily<Job, String> jobProvider =
    FutureProvider.family<Job, String>((Ref ref, String id) => ref.watch(jobsRepositoryProvider).get(id));

final FutureProviderFamily<List<JobEvent>, String> jobTimelineProvider =
    FutureProvider.family<List<JobEvent>, String>((Ref ref, String id) => ref.watch(jobsRepositoryProvider).timeline(id));

final FutureProviderFamily<JobRating?, String> myJobRatingProvider =
    FutureProvider.family<JobRating?, String>((Ref ref, String id) async {
  try {
    return await ref.watch(jobsRepositoryProvider).myRating(id);
  } on AppFailure catch (failure) {
    if (failure.isNotFound) return null;
    rethrow;
  }
});

/// The history list filter: status group + optional day range.
@immutable
class JobHistoryFilter {
  const JobHistoryFilter({this.group = JobStatusGroup.completed, this.from, this.to});

  final JobStatusGroup group;
  final DateTime? from;
  final DateTime? to;

  bool get hasDateRange => from != null || to != null;

  JobHistoryFilter copyWith({JobStatusGroup? group, DateTime? from, DateTime? to, bool clearDates = false}) =>
      JobHistoryFilter(
        group: group ?? this.group,
        from: clearDates ? null : (from ?? this.from),
        to: clearDates ? null : (to ?? this.to),
      );

  @override
  bool operator ==(Object other) =>
      other is JobHistoryFilter && other.group == group && other.from == from && other.to == to;

  @override
  int get hashCode => Object.hash(group, from, to);
}

/// Paginated history for one filter.
class JobHistoryController extends FamilyAsyncNotifier<CursorPage<Job>, JobHistoryFilter> {
  bool _loadingMore = false;

  @override
  Future<CursorPage<Job>> build(JobHistoryFilter arg) =>
      ref.watch(jobsRepositoryProvider).list(group: arg.group, from: arg.from, to: arg.to);

  Future<void> loadMore() async {
    final CursorPage<Job>? current = state.valueOrNull;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final CursorPage<Job> next = await ref
          .read(jobsRepositoryProvider)
          .list(group: arg.group, from: arg.from, to: arg.to, cursor: current.nextCursor);
      state = AsyncValue<CursorPage<Job>>.data(current.concat(next));
    } on AppFailure {
      // Keep what is on screen; the next scroll retries.
    } finally {
      _loadingMore = false;
    }
  }
}

final AsyncNotifierProviderFamily<JobHistoryController, CursorPage<Job>, JobHistoryFilter> jobHistoryProvider =
    AsyncNotifierProvider.family<JobHistoryController, CursorPage<Job>, JobHistoryFilter>(JobHistoryController.new);
