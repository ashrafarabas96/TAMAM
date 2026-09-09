import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/core/widgets/tamam_icon_tile.dart';

/// One service entry point on the home screen.
///
/// Card, dimensional service icon, bold title and a short caption. The icon
/// carries the service's colour and most of the tile's character, so it is a
/// built surface rather than a tinted square with a glyph on it.
class ServiceTile extends StatelessWidget {
  const ServiceTile({
    required this.title,
    required this.onTap,
    this.service,
    this.glyph,
    this.glyphTint,
    super.key,
    this.caption,
    this.badge,
    this.enabled = true,
  });

  final String title;

  /// One of the four illustrated services, or null when [glyph] is given.
  final TamamService? service;
  final IconData? glyph;
  final Color? glyphTint;
  final VoidCallback onTap;
  final String? caption;

  /// Optional corner ribbon, e.g. "جديد" or a promo hint.
  final String? badge;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: TamamCard(
        onTap: enabled ? onTap : null,
        padding: const EdgeInsets.all(TamamSpacing.s4),
        // A minimum, not a fixed height. Large accessibility text and Arabic's
        // extra leading made the title and caption taller than a fixed box could
        // hold, and the QA matrix caught the 7px overflow that a 1.0x English
        // screen never shows. The tile now grows with its text; the grid rows
        // stretch so two tiles side by side still share a height.
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: TamamSize.serviceCardHeight - TamamSpacing.s8,
          ),
          child: Stack(
            children: <Widget>[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  service != null
                      ? TamamIconTile(service: service!, size: TamamSize.serviceIconTile)
                      : TamamIconTile.glyph(
                          icon: glyph!,
                          tint: glyphTint!,
                          size: TamamSize.serviceIconTile,
                        ),
                  const SizedBox(height: TamamSpacing.s3),
                  // Both lines ellipsize; the caption may take two lines when the
                  // text is scaled, since the tile can now grow to hold it.
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                        ),
                        if (caption != null)
                          Text(
                            caption!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (badge != null)
                PositionedDirectional(
                  top: 0,
                  end: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: 2),
                    decoration: BoxDecoration(
                      color: colors.accent,
                      borderRadius: BorderRadius.circular(TamamRadius.pill),
                    ),
                    child: Text(
                      badge!,
                      style: TamamType.labelSm.toTextStyle(color: colors.textOnAccent),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
