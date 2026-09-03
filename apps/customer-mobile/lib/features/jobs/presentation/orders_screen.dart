import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/offline_banner.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/job_card.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// "طلباتي" — every order, split into all / active / completed / cancelled.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> with SingleTickerProviderStateMixin {
  static const List<JobStatusGroup> _tabs = <JobStatusGroup>[
    JobStatusGroup.all,
    JobStatusGroup.active,
    JobStatusGroup.completed,
    JobStatusGroup.cancelled,
  ];

  late final TabController _controller = TabController(length: _tabs.length, vsync: this);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        title: Text(l10n.ordersTitle),
        bottom: TabBar(
          controller: _controller,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: <Widget>[
            Tab(text: l10n.ordersTabAll),
            Tab(text: l10n.ordersTabActive),
            Tab(text: l10n.ordersTabCompleted),
            Tab(text: l10n.ordersTabCancelled),
          ],
        ),
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: TabBarView(
              controller: _controller,
              children: _tabs.map((JobStatusGroup group) => _OrdersList(group: group)).toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrdersList extends ConsumerStatefulWidget {
  const _OrdersList({required this.group});

  final JobStatusGroup group;

  @override
  ConsumerState<_OrdersList> createState() => _OrdersListState();
}

class _OrdersListState extends ConsumerState<_OrdersList> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  /// Infinite scroll: load the next cursor page shortly before the end.
  void _onScroll() {
    if (!_scroll.hasClients) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
      unawaited(ref.read(ordersProvider(widget.group).notifier).loadMore());
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return AsyncView<OrdersPage>(
      value: ref.watch(ordersProvider(widget.group)),
      onRetry: () => ref.invalidate(ordersProvider(widget.group)),
      loading: const Padding(
        padding: EdgeInsets.all(TamamSpacing.s4),
        child: SkeletonList(itemCount: 4, itemHeight: 132),
      ),
      isEmpty: (OrdersPage page) => page.jobs.isEmpty,
      emptyTitle: l10n.ordersEmptyTitle,
      emptyMessage: l10n.ordersEmptyBody,
      emptyIcon: Icons.receipt_long_rounded,
      emptyActionLabel: l10n.ordersEmptyCta,
      onEmptyAction: () => context.go(Routes.home),
      builder: (OrdersPage page) => RefreshIndicator(
        onRefresh: () => ref.read(ordersProvider(widget.group).notifier).refresh(),
        child: ListView.builder(
          controller: _scroll,
          padding: const EdgeInsets.all(TamamSpacing.s4),
          itemCount: page.jobs.length + (page.hasMore ? 1 : 0),
          itemBuilder: (BuildContext context, int index) {
            if (index >= page.jobs.length) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: TamamSpacing.s4),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final Job job = page.jobs[index];
            return JobCard(
              job: job,
              onTap: () => context.push(Routes.job(job.id)),
              trailing: job.isTerminal
                  ? TextButton(
                      onPressed: () => unawaited(_reorder(job)),
                      child: Text(l10n.ordersReorder),
                    )
                  : null,
            );
          },
        ),
      ),
    );
  }

  /// Reorder never creates anything. `POST /customers/me/reorder` returns a
  /// prefilled draft *and* re-validates that the service is still offered, so a
  /// discontinued category fails here rather than at checkout. The customer then
  /// confirms a fresh estimate in the normal flow.
  Future<void> _reorder(Job job) async {
    final JsonMap draft;
    try {
      draft = await ref.read(jobsRepositoryProvider).reorderDraft(job.id);
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
      return;
    }
    if (!mounted) return;

    final String? categoryId = readString(draft, 'categoryId');
    switch (job.type) {
      case JobType.ride:
        context.push(Routes.ride);
      case JobType.delivery:
        context.push(Routes.delivery);
      case JobType.homeService:
        context.push(categoryId == null ? Routes.search : Routes.service(categoryId));
      case JobType.food:
      case JobType.grocery:
      case JobType.pharmacy:
      case JobType.shopping:
      case JobType.moving:
      case JobType.roadAssistance:
        context.push(Routes.home);
    }
  }
}
