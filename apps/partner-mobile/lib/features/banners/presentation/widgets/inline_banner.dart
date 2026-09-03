import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/theme/banner_style.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';
import 'package:tamam_partner/features/banners/presentation/banner_action_handler.dart';
import 'package:tamam_partner/features/banners/presentation/banner_providers.dart';
import 'package:tamam_partner/features/banners/presentation/widgets/banner_creative_view.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// A single banner rendered between sections, or as a checkout/tracking promo.
///
/// Dismissible variants report a DISMISS event and hide themselves for the rest
/// of the session; the server's frequency cap decides whether they come back.
class InlineBanner extends ConsumerStatefulWidget {
  const InlineBanner({
    required this.banner,
    super.key,
    this.aspectRatio,
    this.dismissible = false,
    this.margin = const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
  });

  final PromoBanner banner;
  final double? aspectRatio;
  final bool dismissible;
  final EdgeInsetsGeometry margin;

  @override
  ConsumerState<InlineBanner> createState() => _InlineBannerState();
}

class _InlineBannerState extends ConsumerState<InlineBanner> {
  bool _dismissed = false;

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();
    final PromoBanner banner = widget.banner;
    final double ratio = widget.aspectRatio ?? BannerStyle.forPlacement(banner.placement).aspectRatio;

    return Padding(
      padding: widget.margin,
      child: BannerImpressionTracker(
        trackingKey: '${banner.id}-${banner.placement.value}-inline',
        onImpression: () => ref.read(bannerEventQueueProvider).recordImpression(
              trackingToken: banner.trackingToken,
              placement: banner.placement,
            ),
        child: Stack(
          children: <Widget>[
            AspectRatio(
              aspectRatio: ratio,
              child: Semantics(
                button: banner.isTappable,
                child: GestureDetector(
                  onTap: banner.isTappable
                      ? () => unawaited(BannerActionHandler.handle(context, ref, banner))
                      : null,
                  child: BannerCreativeView(banner: banner, compact: true),
                ),
              ),
            ),
            if (widget.dismissible)
              PositionedDirectional(
                top: TamamSpacing.s1,
                end: TamamSpacing.s1,
                child: _DismissButton(onPressed: _dismiss, label: context.l10n.actionDismiss),
              ),
          ],
        ),
      ),
    );
  }

  void _dismiss() {
    ref.read(bannerEventQueueProvider).recordDismiss(
          trackingToken: widget.banner.trackingToken,
          placement: widget.banner.placement,
        );
    setState(() => _dismissed = true);
  }
}

class _DismissButton extends StatelessWidget {
  const _DismissButton({required this.onPressed, required this.label});

  final VoidCallback onPressed;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: Material(
          color: TamamNeutral.n1000.withOpacity(0.35),
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onPressed,
            customBorder: const CircleBorder(),
            child: const SizedBox(
              width: 32,
              height: 32,
              child: Icon(Icons.close_rounded, size: 18, color: TamamNeutral.n0),
            ),
          ),
        ),
      );
}
