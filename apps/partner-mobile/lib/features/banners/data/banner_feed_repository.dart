import 'dart:io' show Platform;

import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';

/// Fetches and caches banner feeds per placement.
///
/// Three layers, in order:
///  1. an in-memory feed that is still inside its `cacheUntil` window;
///  2. the network;
///  3. the last successful feed persisted on disk (used offline, and marked
///     stale so the next foreground refresh replaces it).
///
/// A banner is decoration: any failure resolves to an empty feed rather than an
/// error state, so a campaign outage can never break the home screen.
class BannerFeedRepository {
  BannerFeedRepository({required ApiClient api, required PrefsStore prefs})
      : _api = api,
        _prefs = prefs;

  final ApiClient _api;
  final PrefsStore _prefs;
  final Map<BannerPlacement, BannerFeed> _memory = <BannerPlacement, BannerFeed>{};

  /// Returns the feed for [placement], honouring the server's cache window
  /// unless [forceRefresh] is set (pull-to-refresh, language change).
  Future<BannerFeed> feed(
    BannerPlacement placement, {
    GeoPoint? near,
    String? zoneId,
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      final BannerFeed? cached = _memory[placement];
      if (cached != null && cached.isFresh) return cached;
    }

    try {
      final JsonMap json = await _api.getObject(
        ApiPaths.bannerFeed,
        query: <String, Object?>{
          'placement': placement.value,
          if (zoneId != null) 'zoneId': zoneId,
          if (near != null) 'lat': near.lat,
          if (near != null) 'lng': near.lng,
          'platform': _platform,
        },
      );
      final BannerFeed feed = BannerFeed.fromJson(json);
      _memory[placement] = feed;
      await _persist(feed);
      return feed;
    } on AppFailure {
      return _memory[placement] ?? _readPersisted(placement);
    }
  }

  /// Drops every cached feed — called on sign-out and on language change, since
  /// targeting and creatives are both user- and language-specific.
  Future<void> invalidateAll() async {
    _memory.clear();
    for (final BannerPlacement placement in BannerPlacement.values) {
      await _prefs.remove(PrefsStore.bannerFeedKey(placement.value));
    }
  }

  String get _platform {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }

  Future<void> _persist(BannerFeed feed) =>
      _prefs.setJson(PrefsStore.bannerFeedKey(feed.placement.value), feed.toJson());

  BannerFeed _readPersisted(BannerPlacement placement) {
    final JsonMap? json = _prefs.getJson(PrefsStore.bannerFeedKey(placement.value));
    if (json == null) return BannerFeed.empty(placement);
    final BannerFeed feed = BannerFeed.fromJson(json);
    // Persisted feeds are shown offline but never treated as fresh, so the next
    // successful call always wins.
    return BannerFeed(placement: feed.placement, banners: feed.banners, cacheUntil: null);
  }
}
