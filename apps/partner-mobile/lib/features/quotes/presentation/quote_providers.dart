import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/quotes/data/quotes_repository.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/features/quotes/domain/quote_draft.dart';

final Provider<QuotesRepository> quotesRepositoryProvider =
    Provider<QuotesRepository>((Ref ref) => QuotesRepository(ref.watch(apiClientProvider)));

/// All quotes of one job, newest revision first.
final FutureProviderFamily<List<Quote>, String> jobQuotesProvider =
    FutureProvider.family<List<Quote>, String>((Ref ref, String jobId) => ref.watch(quotesRepositoryProvider).list(jobId));

/// The builder's arguments: which job, and whether this is a change order.
@immutable
class QuoteBuilderArgs {
  const QuoteBuilderArgs({required this.jobId, required this.changeOrder});

  final String jobId;
  final bool changeOrder;

  @override
  bool operator ==(Object other) =>
      other is QuoteBuilderArgs && other.jobId == jobId && other.changeOrder == changeOrder;

  @override
  int get hashCode => Object.hash(jobId, changeOrder);
}

@immutable
class QuoteBuilderState {
  const QuoteBuilderState({
    required this.draft,
    required this.version,
    this.busy = false,
    this.failure,
    this.submittedJob,
    this.rejectedNote,
  });

  final QuoteDraft draft;

  /// The job version the submission must echo.
  final int version;
  final bool busy;
  final AppFailure? failure;

  /// The job returned by a successful submit.
  final Job? submittedJob;

  /// The customer's note on the previous rejection, shown while resubmitting.
  final String? rejectedNote;

  QuoteBuilderState copyWith({
    QuoteDraft? draft,
    int? version,
    bool? busy,
    AppFailure? failure,
    bool clearFailure = false,
    Job? submittedJob,
    String? rejectedNote,
  }) =>
      QuoteBuilderState(
        draft: draft ?? this.draft,
        version: version ?? this.version,
        busy: busy ?? this.busy,
        failure: clearFailure ? null : (failure ?? this.failure),
        submittedJob: submittedJob ?? this.submittedJob,
        rejectedNote: rejectedNote ?? this.rejectedNote,
      );
}

/// Holds the quote being built for one job.
///
/// A resubmission after a rejection starts from the rejected quote's lines so
/// the partner edits rather than retypes; a change order starts empty because
/// it only carries the *additional* work.
class QuoteBuilderController extends AutoDisposeFamilyAsyncNotifier<QuoteBuilderState, QuoteBuilderArgs> {
  @override
  Future<QuoteBuilderState> build(QuoteBuilderArgs arg) async {
    final Job job = await ref.watch(jobProvider(arg.jobId).future);
    final Quote? previous = job.activeQuote;
    final bool prefill = !arg.changeOrder && previous != null && previous.isRejected;
    final QuoteDraft draft = QuoteDraft(
      currency: job.currency,
      kind: arg.changeOrder ? QuoteKind.changeOrder : QuoteKind.initial,
      items: prefill
          ? previous.items
              .map(
                (QuoteItem item) => QuoteDraftItem(
                  kind: item.kind,
                  description: item.description,
                  quantity: item.quantity,
                  unitPriceMinor: item.unitPrice.amount,
                ),
              )
              .toList(growable: false)
          : const <QuoteDraftItem>[],
      discountMinor: prefill ? previous.discount.amount : 0,
      description: prefill ? (previous.description ?? '') : '',
      estimatedDurationMin: prefill ? previous.estimatedDurationMin : null,
    );
    return QuoteBuilderState(
      draft: draft,
      version: job.version,
      rejectedNote: previous != null && previous.isRejected ? previous.decisionNote : null,
    );
  }

  void _update(QuoteDraft Function(QuoteDraft draft) change) {
    final QuoteBuilderState? current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue<QuoteBuilderState>.data(current.copyWith(draft: change(current.draft), clearFailure: true));
  }

  void addItem(QuoteDraftItem item) => _update((QuoteDraft d) => d.addItem(item));

  void replaceItem(int index, QuoteDraftItem item) => _update((QuoteDraft d) => d.replaceItem(index, item));

  void removeItem(int index) => _update((QuoteDraft d) => d.removeItem(index));

  void setDiscount(int minor) => _update((QuoteDraft d) => d.copyWith(discountMinor: minor < 0 ? 0 : minor));

  void setDescription(String text) => _update((QuoteDraft d) => d.copyWith(description: text));

  void setDuration(int? minutes) =>
      _update((QuoteDraft d) => d.copyWith(estimatedDurationMin: minutes, clearDuration: minutes == null));

  /// Submits; on `VERSION_CONFLICT` the job is refetched and the new version
  /// stored so the next tap succeeds.
  Future<bool> submit() async {
    final QuoteBuilderState? current = state.valueOrNull;
    if (current == null || current.busy || !current.draft.canSubmit) return false;
    state = AsyncValue<QuoteBuilderState>.data(current.copyWith(busy: true, clearFailure: true));
    try {
      final Job job = await ref.read(quotesRepositoryProvider).submit(arg.jobId, current.draft, version: current.version);
      ref
        ..invalidate(jobProvider(arg.jobId))
        ..invalidate(jobQuotesProvider(arg.jobId))
        ..invalidate(activeJobsProvider);
      state = AsyncValue<QuoteBuilderState>.data(current.copyWith(busy: false, submittedJob: job));
      return true;
    } on AppFailure catch (failure) {
      int version = current.version;
      if (failure.isVersionConflict) {
        try {
          version = (await ref.read(jobsRepositoryProvider).get(arg.jobId)).version;
        } on AppFailure {
          // Keep the stale version; the next attempt will refetch again.
        }
      }
      state = AsyncValue<QuoteBuilderState>.data(current.copyWith(busy: false, failure: failure, version: version));
      return false;
    }
  }
}

final AutoDisposeAsyncNotifierProviderFamily<QuoteBuilderController, QuoteBuilderState, QuoteBuilderArgs>
    quoteBuilderProvider =
    AsyncNotifierProvider.autoDispose.family<QuoteBuilderController, QuoteBuilderState, QuoteBuilderArgs>(
  QuoteBuilderController.new,
);
