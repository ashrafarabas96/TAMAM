import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/banners/data/banner_event_queue.dart';
import 'package:tamam_partner/features/banners/data/banner_feed_repository.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';
import 'package:tamam_partner/features/location/presentation/location_providers.dart';

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
/// need to check the flag themselves. Targeting uses the partner's last known
/// position, which the work session keeps fresh while online.
class BannerFeedController extends FamilyAsyncNotifier<BannerFeed, BannerPlacement> {
  @override
  Future<BannerFeed> build(BannerPlacement arg) async {
    if (!ref.watch(featureFlagsValueProvider).hasPromoBanners) return BannerFeed.empty(arg);
    // Creatives and targeting are language- and location-specific.
    ref.watch(localeControllerProvider);
    return ref.watch(bannerFeedRepositoryProvider).feed(arg, near: ref.read(lastKnownPointProvider));
  }

  /// Forces a network round-trip, bypassing the `cacheUntil` window.
  Future<void> refresh() async {
    state = const AsyncValue<BannerFeed>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(
      () => ref.read(bannerFeedRepositoryProvider).feed(
            arg,
            near: ref.read(lastKnownPointProvider),
            forceRefresh: true,
          ),
    );
  }
}

final AsyncNotifierProviderFamily<BannerFeedController, BannerFeed, BannerPlacement> bannerFeedProvider =
    AsyncNotifierProvider.family<BannerFeedController, BannerFeed, BannerPlacement>(BannerFeedController.new);
