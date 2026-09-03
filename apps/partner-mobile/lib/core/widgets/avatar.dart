import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Circular avatar with an initials fallback, used for partners and the profile.
class TamamAvatar extends StatelessWidget {
  const TamamAvatar({
    required this.initials,
    super.key,
    this.imageUrl,
    this.size = TamamSize.avatarMd,
  });

  final String initials;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final Widget fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: colors.surfaceBrandSoft,
      child: Text(
        initials,
        style: TamamType.labelLg.toTextStyle(color: colors.primary),
      ),
    );

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl == null || imageUrl!.isEmpty
            ? fallback
            : CachedNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                width: size,
                height: size,
                placeholder: (BuildContext _, String __) => ColoredBox(color: colors.skeleton),
                errorWidget: (BuildContext _, String __, Object ___) => fallback,
              ),
      ),
    );
  }
}
