import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/localized_text.dart';

/// The artwork and copy of one banner (`BannerCreativeDto`).
///
/// Every text field is optional because a creative may carry its own baked-in
/// typography; the overlay is only drawn for the fields that exist.
class BannerCreative {
  const BannerCreative({
    required this.imageUrl,
    required this.theme,
    this.headline,
    this.subheadline,
    this.ctaLabel,
    this.badge,
  });

  factory BannerCreative.fromJson(JsonMap json) => BannerCreative(
        imageUrl: LocalizedText.required(json, 'imageUrl'),
        theme: readStringOr(json, 'theme', 'purple'),
        headline: LocalizedText.maybe(json, 'headline'),
        subheadline: LocalizedText.maybe(json, 'subheadline'),
        ctaLabel: LocalizedText.maybe(json, 'ctaLabel'),
        badge: LocalizedText.maybe(json, 'badge'),
      );

  /// Localised so Arabic art can differ from English art.
  final LocalizedText imageUrl;

  /// Key into `TamamBannerThemes` — drives text colour and the fallback fill.
  final String theme;
  final LocalizedText? headline;
  final LocalizedText? subheadline;
  final LocalizedText? ctaLabel;
  final LocalizedText? badge;

  bool get hasOverlayText => headline != null || subheadline != null || ctaLabel != null || badge != null;

  JsonMap toJson() => <String, Object?>{
        'imageUrl': imageUrl.toJson(),
        'theme': theme,
        'headline': headline?.toJson(),
        'subheadline': subheadline?.toJson(),
        'ctaLabel': ctaLabel?.toJson(),
        'badge': badge?.toJson(),
      };
}

/// One targeted banner (`BannerDto`).
class PromoBanner {
  const PromoBanner({
    required this.id,
    required this.campaignId,
    required this.placement,
    required this.creative,
    required this.actionType,
    required this.priority,
    required this.trackingToken,
    this.actionValue,
  });

  factory PromoBanner.fromJson(JsonMap json) => PromoBanner(
        id: readStringOr(json, 'id', ''),
        campaignId: readStringOr(json, 'campaignId', ''),
        placement: BannerPlacement.fromValue(readString(json, 'placement')) ?? BannerPlacement.homeHero,
        creative: readObject<BannerCreative>(json, 'creative', BannerCreative.fromJson) ??
            const BannerCreative(imageUrl: LocalizedText(ar: '', en: ''), theme: 'purple'),
        actionType: BannerActionType.fromValue(readString(json, 'actionType')) ?? BannerActionType.none,
        priority: readIntOr(json, 'priority', 0),
        trackingToken: readStringOr(json, 'trackingToken', ''),
        actionValue: readString(json, 'actionValue'),
      );

  final String id;
  final String campaignId;
  final BannerPlacement placement;
  final BannerCreative creative;
  final BannerActionType actionType;

  /// Route, URL, promo code or category id, depending on [actionType].
  final String? actionValue;
  final int priority;

  /// Signed token echoed back on every impression/click so the server can
  /// attribute the event without the client knowing campaign internals.
  final String trackingToken;

  bool get isTappable => actionType != BannerActionType.none && (actionValue?.isNotEmpty ?? false);

  JsonMap toJson() => <String, Object?>{
        'id': id,
        'campaignId': campaignId,
        'placement': placement.value,
        'creative': creative.toJson(),
        'actionType': actionType.value,
        'actionValue': actionValue,
        'priority': priority,
        'trackingToken': trackingToken,
      };
}

/// A cached feed for one placement (`BannerFeedDto`).
class BannerFeed {
  const BannerFeed({required this.placement, required this.banners, required this.cacheUntil});

  factory BannerFeed.fromJson(JsonMap json) => BannerFeed(
        placement: BannerPlacement.fromValue(readString(json, 'placement')) ?? BannerPlacement.homeHero,
        banners: readList<PromoBanner>(json, 'banners', PromoBanner.fromJson),
        cacheUntil: readDateTimeOr(json, 'cacheUntil', DateTime.now()),
      );

  const BannerFeed.empty(this.placement)
      : banners = const <PromoBanner>[],
        cacheUntil = null;

  final BannerPlacement placement;
  final List<PromoBanner> banners;

  /// The client may serve this feed from memory/disk until this moment.
  final DateTime? cacheUntil;

  bool get isEmpty => banners.isEmpty;

  bool get isFresh => cacheUntil != null && DateTime.now().isBefore(cacheUntil!);

  JsonMap toJson() => <String, Object?>{
        'placement': placement.value,
        'banners': banners.map((PromoBanner b) => b.toJson()).toList(growable: false),
        'cacheUntil': cacheUntil?.toUtc().toIso8601String(),
      };
}
