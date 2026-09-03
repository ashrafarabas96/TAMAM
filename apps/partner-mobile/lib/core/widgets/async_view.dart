import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/empty_state.dart';
import 'package:tamam_partner/core/widgets/skeleton_box.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Renders the four mandatory states of every API-backed surface:
/// loading, empty, error+retry and offline (spec §4 mobile).
///
/// Screens pass only the data builder; the rest is uniform by construction, so
/// no screen can accidentally ship without an error path.
class AsyncView<T> extends ConsumerWidget {
  const AsyncView({
    required this.value,
    required this.onRetry,
    required this.builder,
    super.key,
    this.loading,
    this.isEmpty,
    this.emptyTitle,
    this.emptyMessage,
    this.emptyIcon = Icons.inbox_rounded,
    this.emptyActionLabel,
    this.onEmptyAction,
    this.skipLoadingOnRefresh = true,
  });

  final AsyncValue<T> value;

  /// Re-runs the request; wired to both the error and the offline states.
  final VoidCallback onRetry;
  final Widget Function(T data) builder;

  /// Defaults to a shimmering list; pass a shape that matches the real content.
  final Widget? loading;

  /// Lets a list report emptiness without [AsyncView] knowing its element type.
  final bool Function(T data)? isEmpty;
  final String? emptyTitle;
  final String? emptyMessage;
  final IconData emptyIcon;
  final String? emptyActionLabel;
  final VoidCallback? onEmptyAction;

  /// Keeps previous content on screen while a pull-to-refresh runs.
  final bool skipLoadingOnRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return value.when(
      skipLoadingOnRefresh: skipLoadingOnRefresh,
      skipLoadingOnReload: skipLoadingOnRefresh,
      data: (T data) {
        if (isEmpty != null && isEmpty!(data)) {
          return EmptyState(
            title: emptyTitle ?? context.l10n.emptyTitle,
            message: emptyMessage,
            icon: emptyIcon,
            actionLabel: emptyActionLabel,
            onAction: onEmptyAction,
          );
        }
        return builder(data);
      },
      loading: () => loading ?? const _DefaultLoading(),
      error: (Object error, StackTrace _) => FailureView(failure: asFailure(error), onRetry: onRetry),
    );
  }
}

/// Error / offline presentation shared by [AsyncView] and imperative flows.
class FailureView extends StatelessWidget {
  const FailureView({required this.failure, required this.onRetry, super.key, this.compact = false});

  final AppFailure failure;
  final VoidCallback onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final bool offline = failure.isNetwork;
    if (compact) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            Icon(
              offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
              color: offline ? context.colors.warning : context.colors.danger,
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(localizedFailure(l10n, failure))),
            if (failure.isRetryable) TextButton(onPressed: onRetry, child: Text(l10n.actionRetry)),
          ],
        ),
      );
    }
    return EmptyState(
      icon: offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
      tone: offline ? EmptyStateTone.warning : EmptyStateTone.danger,
      title: offline ? l10n.errorOfflineTitle : l10n.errorTitle,
      message: localizedFailure(l10n, failure),
      actionLabel: failure.isRetryable ? l10n.actionRetry : null,
      onAction: failure.isRetryable ? onRetry : null,
    );
  }
}

class _DefaultLoading extends StatelessWidget {
  const _DefaultLoading();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.all(16),
        child: SkeletonList(),
      );
}
