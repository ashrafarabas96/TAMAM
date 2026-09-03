import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/routing/deep_links.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';
import 'package:url_launcher/url_launcher.dart';

/// Executes what a banner promises when it is tapped.
///
/// The click event is recorded *before* navigating so attribution survives a
/// deep link that leaves the app.
abstract final class BannerActionHandler {
  static Future<void> handle(BuildContext context, WidgetRef ref, PromoBanner banner) async {
    ref.read(bannerEventQueueProvider).recordClick(
          trackingToken: banner.trackingToken,
          placement: banner.placement,
        );

    final String? value = banner.actionValue;
    if (value == null || value.isEmpty) return;

    switch (banner.actionType) {
      case BannerActionType.none:
        return;
      case BannerActionType.deepLink:
        _openDeepLink(context, value);
      case BannerActionType.serviceCategory:
        context.push(Routes.category(value));
      case BannerActionType.promoCode:
        await _applyPromoCode(context, ref, value);
      case BannerActionType.externalUrl:
        await _openExternal(context, value);
    }
  }

  static void _openDeepLink(BuildContext context, String value) {
    final Uri? uri = Uri.tryParse(value);
    final String? location = uri == null ? null : DeepLinks.resolve(uri);
    if (location == null) return;
    context.push(location);
  }

  /// Copies the code, remembers it for the next checkout, and says so.
  static Future<void> _applyPromoCode(BuildContext context, WidgetRef ref, String code) async {
    final String normalised = code.trim().toUpperCase();
    await Clipboard.setData(ClipboardData(text: normalised));
    await ref.read(pendingPromoProvider.notifier).set(normalised);
    if (!context.mounted) return;
    AppFeedback.showMessage(
      context,
      context.l10n.bannerPromoCopied(normalised),
      icon: Icons.local_offer_rounded,
    );
  }

  /// External links always ask first — a banner should never silently throw the
  /// customer out of the app.
  static Future<void> _openExternal(BuildContext context, String value) async {
    final Uri? uri = Uri.tryParse(value);
    if (uri == null || !uri.hasScheme) return;
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.bannerLeaveAppTitle,
      message: l10n.bannerLeaveAppMessage(uri.host),
      confirmLabel: l10n.actionContinue,
    );
    if (!confirmed) return;
    final bool opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      AppFeedback.showMessage(context, l10n.errorCannotOpenLink, icon: Icons.link_off_rounded);
    }
  }
}
