import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// A slim strip pinned under the app bar while the device is offline.
///
/// Placed once per shell rather than per screen, so it never double-renders.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool online = ref.watch(isOnlineProvider);
    final TamamColors colors = context.colors;
    return AnimatedSize(
      duration: TamamMotion.durationBase,
      curve: Curves.easeOut,
      alignment: Alignment.topCenter,
      child: online
          ? const SizedBox(width: double.infinity)
          : Semantics(
              liveRegion: true,
              child: Container(
                width: double.infinity,
                color: colors.warningSoft,
                padding: const EdgeInsets.symmetric(
                  horizontal: TamamSpacing.s4,
                  vertical: TamamSpacing.s2,
                ),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.wifi_off_rounded, size: TamamSize.iconSm, color: TamamSemantic.warningStrong),
                    const SizedBox(width: TamamSpacing.s2),
                    Expanded(
                      child: Text(
                        context.l10n.offlineBanner,
                        style: TamamType.labelMd.toTextStyle(color: TamamSemantic.warningStrong),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
