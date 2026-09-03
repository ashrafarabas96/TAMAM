import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/features/banners/data/banner_event_queue.dart';
import 'package:tamam_customer/features/banners/data/banner_feed_repository.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';

final Provider<BannerFeedRepository> bannerFeedRepositoryProvider = Provider<BannerFeedRepository>(
  (Ref ref) => BannerFeedRepository(
    api: ref.watch(apiClientProvider),
    prefs: ref.watch(prefsStoreProvider),
  ),
);

/// One queue for the whole app: batching only works if every placement shares it.
final Provider<BannerEventQueue> bannerEventQueueProvider = Provider<BannerEventQueue>((Ref ref) {
  final BannerEventQueue queue = BannerEventQueue(
    api: ref.watch(apiClientProvider),
    prefs: ref.watch(prefsStoreProvider),
    sessionId: ref.watch(appSessionIdProvider),
  );
  ref.onDispose(queue.dispose);
  return queue;
});

/// The feed for one placement.
///
/// Returns an empty feed when the `promo_banners` flag is off, so callers never
/// need to check the flag themselves.
class BannerFeedController extends FamilyAsyncNotifier<BannerFeed, BannerPlacement> {
  @override
  Future<BannerFeed> build(BannerPlacement arg) async {
    if (!ref.watch(featureFlagsValueProvider).hasPromoBanners) return BannerFeed.empty(arg);
    // Creatives and targeting are language- and location-specific.
    ref.watch(localeControllerProvider);
    return ref.watch(bannerFeedRepositoryProvider).feed(arg, near: ref.watch(currentPointProvider));
  }

  /// Forces a network round-trip, bypassing the `cacheUntil` window.
  Future<void> refresh() async {
    state = const AsyncValue<BannerFeed>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(
      () => ref.read(bannerFeedRepositoryProvider).feed(
            arg,
            near: ref.read(currentPointProvider),
            forceRefresh: true,
          ),
    );
  }
}

final AsyncNotifierProviderFamily<BannerFeedController, BannerFeed, BannerPlacement> bannerFeedProvider =
    AsyncNotifierProvider.family<BannerFeedController, BannerFeed, BannerPlacement>(BannerFeedController.new);

/// A promo code a banner handed the customer, waiting to be applied at the next
/// checkout. Cleared once it is used.
class PendingPromoController extends Notifier<String?> {
  @override
  String? build() => ref.read(prefsStoreProvider).getString(PrefsStore.keyPendingPromoCode);

  Future<void> set(String code) async {
    state = code;
    await ref.read(prefsStoreProvider).setString(PrefsStore.keyPendingPromoCode, code);
  }

  Future<void> clear() async {
    state = null;
    await ref.read(prefsStoreProvider).remove(PrefsStore.keyPendingPromoCode);
  }
}

final NotifierProvider<PendingPromoController, String?> pendingPromoProvider =
    NotifierProvider<PendingPromoController, String?>(PendingPromoController.new);
