import 'package:flutter/material.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';

/// The four services, drawn as the brand's own artwork.
///
/// These are the illustrations from the identity sheet — a yellow taxi, a
/// ribboned parcel, a toolbox, a chalet on its island — not icons approximating
/// them. An earlier version of this widget built a gradient tile and set a
/// Material glyph on top; it was a reasonable stand-in and it looked like one.
enum TamamService { rides, delivery, homeServices, chalet }

/// The illustrated service a job belongs to, or null for the kinds the identity
/// sheet has no artwork for (food, grocery, moving, ...); those keep a glyph.
TamamService? serviceFor(JobType type) => switch (type) {
      JobType.ride => TamamService.rides,
      JobType.delivery => TamamService.delivery,
      JobType.homeService => TamamService.homeServices,
      _ => null,
    };

extension TamamServiceAsset on TamamService {
  String get asset => switch (this) {
        TamamService.rides => 'assets/brand/services/rides.png',
        TamamService.delivery => 'assets/brand/services/delivery.png',
        TamamService.homeServices => 'assets/brand/services/services.png',
        TamamService.chalet => 'assets/brand/services/chalet.png',
      };

  /// The colour this service casts into the UI around it — its glow, its chips,
  /// its progress. Taken from the artwork, so a screen tinted for a service
  /// agrees with the picture at the top of it.
  Color get tint => switch (this) {
        TamamService.rides => TamamServiceColors.ride,
        TamamService.delivery => TamamServiceColors.delivery,
        TamamService.homeServices => TamamServiceColors.homeService,
        TamamService.chalet => TamamServiceColors.chalet,
      };
}

/// Presents one service illustration at a consistent optical size.
///
/// The artwork carries its own modelling and its own contact shadow, so nothing
/// is drawn behind it: a card or a tinted plate under a rendered object reads as
/// a sticker on a surface rather than an object on it. What this adds is the
/// ambient glow, which is the part a flat asset cannot do for itself — it is
/// tinted by the service and it deepens in the dark theme, because a lit object
/// throws more light onto a dark ground than a light one.
class TamamIconTile extends StatelessWidget {
  const TamamIconTile({
    required this.service,
    super.key,
    this.size = 56,
    this.pressed = false,
    this.glow = true,
  })  : glyph = null,
        glyphTint = null;

  /// For an entry the identity sheet has no artwork for — Urgent is a way of
  /// asking for a service rather than a service. It deliberately does not
  /// imitate the rendered set: a flat mark in a brand plate reads as a different
  /// kind of thing, which is what it is.
  const TamamIconTile.glyph({
    required IconData icon,
    required Color tint,
    super.key,
    this.size = 56,
    this.pressed = false,
    this.glow = true,
  })  : service = null,
        glyph = icon,
        glyphTint = tint;

  final TamamService? service;
  final IconData? glyph;
  final Color? glyphTint;
  final double size;

  /// Lets a parent press animation settle the object toward its surface.
  final bool pressed;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final double settle = pressed ? 0.45 : 1;
    final Color tint = service?.tint ?? glyphTint!;

    return AnimatedContainer(
      duration: TamamMotion.durationFast,
      curve: Curves.easeOut,
      width: size,
      height: size,
      decoration: !glow
          ? null
          : BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: tint.withValues(alpha: (isDark ? 0.34 : 0.20) * settle),
                  blurRadius: size * (isDark ? 0.42 : 0.34) * settle,
                  offset: Offset(0, size * 0.10 * settle),
                  spreadRadius: -size * 0.10,
                ),
              ],
            ),
      child: glyph != null
          ? _GlyphPlate(icon: glyph!, tint: tint, size: size, isDark: isDark)
          : Image.asset(
              service!.asset,
              fit: BoxFit.contain,
              // The artwork is authored at 3x; letting Flutter pick the density
              // variant keeps it crisp without decoding the largest file
              // everywhere.
              filterQuality: FilterQuality.medium,
            ),
    );
  }
}

class _GlyphPlate extends StatelessWidget {
  const _GlyphPlate({
    required this.icon,
    required this.tint,
    required this.size,
    required this.isDark,
  });

  final IconData icon;
  final Color tint;
  final double size;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.30),
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: <Color>[
            Color.alphaBlend(Colors.white.withValues(alpha: isDark ? 0.16 : 0.24), tint),
            tint,
          ],
        ),
      ),
      child: Center(
        child: Icon(icon, size: size * 0.48, color: Colors.white),
      ),
    );
  }
}
