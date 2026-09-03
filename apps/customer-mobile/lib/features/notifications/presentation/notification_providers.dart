import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/notifications/data/notifications_repository.dart';

final Provider<NotificationsRepository> notificationsRepositoryProvider =
    Provider<NotificationsRepository>((Ref ref) => NotificationsRepository(ref.watch(apiClientProvider)));

/// Badge count for the account tab and the home bell.
///
/// A failure resolves to zero rather than an error: a missing badge is a much
/// smaller problem than a broken screen.
final FutureProvider<int> unreadNotificationsProvider = FutureProvider<int>((Ref ref) async {
  if (!ref.watch(sessionControllerProvider).isAuthenticated) return 0;
  try {
    return await ref.watch(notificationsRepositoryProvider).unreadCount();
  } on AppFailure {
    return 0;
  }
});

/// The inbox, paginated.
class NotificationsController extends AsyncNotifier<List<AppNotification>> {
  String? _cursor;

  @override
  Future<List<AppNotification>> build() async {
    final CursorPage<AppNotification> page = await ref.watch(notificationsRepositoryProvider).list();
    _cursor = page.nextCursor;
    return page.items;
  }

  bool get hasMore => _cursor != null && _cursor!.isNotEmpty;

  Future<void> loadMore() async {
    final List<AppNotification>? current = state.valueOrNull;
    if (current == null || !hasMore) return;
    try {
      final CursorPage<AppNotification> page =
          await ref.read(notificationsRepositoryProvider).list(cursor: _cursor);
      _cursor = page.nextCursor;
      state = AsyncValue<List<AppNotification>>.data(<AppNotification>[...current, ...page.items]);
    } on AppFailure {
      // Keep what is on screen; the retry is the next scroll.
    }
  }

  /// Marks one notification (or all, when [id] is null) as read.
  Future<void> markRead({String? id}) async {
    await ref.read(notificationsRepositoryProvider).markRead(ids: id == null ? const <String>[] : <String>[id]);
    ref.invalidateSelf();
    ref.invalidate(unreadNotificationsProvider);
  }
}

final AsyncNotifierProvider<NotificationsController, List<AppNotification>> notificationsProvider =
    AsyncNotifierProvider<NotificationsController, List<AppNotification>>(NotificationsController.new);

/// Channel preferences, edited from the account screen.
class NotificationPreferencesController extends AsyncNotifier<NotificationPreferences> {
  @override
  Future<NotificationPreferences> build() => ref.watch(notificationsRepositoryProvider).preferences();

  /// Named `save`, not `update`: `AsyncNotifier` already defines an `update` with a
  /// different signature, and overriding it with this one is not valid.
  Future<void> save(NotificationPreferences next) async {
    state = AsyncValue<NotificationPreferences>.data(next);
    state = await AsyncValue.guard(
      () => ref.read(notificationsRepositoryProvider).updatePreferences(next),
    );
  }
}

final AsyncNotifierProvider<NotificationPreferencesController, NotificationPreferences>
    notificationPreferencesProvider =
    AsyncNotifierProvider<NotificationPreferencesController, NotificationPreferences>(
  NotificationPreferencesController.new,
);
