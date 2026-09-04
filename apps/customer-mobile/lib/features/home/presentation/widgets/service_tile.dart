import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';

/// One service entry point on the home screen.
///
/// White card, coloured icon circle, bold title and a short caption — the
/// Getir-style tile the whole home screen is built around.
class ServiceTile extends StatelessWidget {
  const ServiceTile({
    required this.title,
    required this.icon,
    required this.color,
    required this.onTap,
    super.key,
    this.caption,
    this.badge,
    this.enabled = true,
  });

  final String title;
  final IconData icon;
  final Color color;
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
        child: SizedBox(
          height: TamamSize.serviceCardHeight - TamamSpacing.s8,
          child: Stack(
            children: <Widget>[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(TamamRadius.md),
                    ),
                    child: Icon(icon, size: TamamSize.iconLg, color: color),
                  ),
                  // Flexible, not a bare Column: title + caption at their natural line
                  // heights are a couple of pixels taller than the fixed card leaves them,
                  // and any user text scaling makes that worse. Both lines already
                  // ellipsize, so shrinking degrades gracefully instead of overflowing.
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
                            maxLines: 1,
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
