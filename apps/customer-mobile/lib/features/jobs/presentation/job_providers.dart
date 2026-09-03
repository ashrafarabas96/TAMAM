import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/data/pricing_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';

final Provider<JobsRepository> jobsRepositoryProvider =
    Provider<JobsRepository>((Ref ref) => JobsRepository(ref.watch(apiClientProvider)));

final Provider<PricingRepository> pricingRepositoryProvider =
    Provider<PricingRepository>((Ref ref) => PricingRepository(ref.watch(apiClientProvider)));

/// A page of orders plus the paging cursor, for one tab.
class OrdersPage {
  const OrdersPage({required this.jobs, required this.nextCursor, this.loadingMore = false});

  final List<Job> jobs;
  final String? nextCursor;
  final bool loadingMore;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  OrdersPage copyWith({List<Job>? jobs, String? nextCursor, bool? loadingMore, bool clearCursor = false}) =>
      OrdersPage(
        jobs: jobs ?? this.jobs,
        nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
        loadingMore: loadingMore ?? this.loadingMore,
      );
}

/// Cursor-paginated orders for one status tab.
class OrdersController extends FamilyAsyncNotifier<OrdersPage, JobStatusGroup> {
  @override
  Future<OrdersPage> build(JobStatusGroup arg) async {
    final CursorPage<Job> page = await ref.watch(jobsRepositoryProvider).list(group: arg);
    return OrdersPage(jobs: page.items, nextCursor: page.nextCursor);
  }

  /// Appends the next page; a failure leaves the current list untouched so the
  /// customer never loses what they were reading.
  Future<void> loadMore() async {
    final OrdersPage? current = state.valueOrNull;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncValue<OrdersPage>.data(current.copyWith(loadingMore: true));
    try {
      final CursorPage<Job> next =
          await ref.read(jobsRepositoryProvider).list(group: arg, cursor: current.nextCursor);
      state = AsyncValue<OrdersPage>.data(
        OrdersPage(jobs: <Job>[...current.jobs, ...next.items], nextCursor: next.nextCursor),
      );
    } on AppFailure {
      state = AsyncValue<OrdersPage>.data(current.copyWith(loadingMore: false));
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue<OrdersPage>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(() async {
      final CursorPage<Job> page = await ref.read(jobsRepositoryProvider).list(group: arg);
      return OrdersPage(jobs: page.items, nextCursor: page.nextCursor);
    });
  }
}

final AsyncNotifierProviderFamily<OrdersController, OrdersPage, JobStatusGroup> ordersProvider =
    AsyncNotifierProvider.family<OrdersController, OrdersPage, JobStatusGroup>(OrdersController.new);

/// The customer's currently active jobs, used for the pinned home banner.
final FutureProvider<List<Job>> activeJobsProvider = FutureProvider<List<Job>>((Ref ref) async {
  // Re-reads whenever the orders list is refreshed, keeping home and orders in sync.
  final CursorPage<Job> page =
      await ref.watch(jobsRepositoryProvider).list(group: JobStatusGroup.active, limit: 5);
  return page.items;
});

/// One job, refreshable on demand.
final FutureProviderFamily<Job, String> jobProvider = FutureProvider.family<Job, String>(
  (Ref ref, String id) => ref.watch(jobsRepositoryProvider).get(id),
);

final FutureProviderFamily<List<JobEvent>, String> jobTimelineProvider =
    FutureProvider.family<List<JobEvent>, String>(
  (Ref ref, String id) => ref.watch(jobsRepositoryProvider).timeline(id),
);

final FutureProviderFamily<JobPayment?, String> jobPaymentProvider =
    FutureProvider.family<JobPayment?, String>(
  (Ref ref, String id) => ref.watch(jobsRepositoryProvider).payment(id),
);
