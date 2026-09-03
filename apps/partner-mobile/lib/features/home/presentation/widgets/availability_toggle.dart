import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The big ONLINE / OFFLINE pill in the header.
///
/// Yellow when online, grey when offline, with a spinner while a transition is
/// in flight. It is a *display* of the server's answer: tapping it asks the
/// parent to start a transition and nothing flips until the server agrees.
class AvailabilityToggle extends StatelessWidget {
  const AvailabilityToggle({
    required this.online,
    required this.busy,
    required this.onTap,
    super.key,
    this.onJob = false,
  });

  final bool online;
  final bool busy;
  final bool onJob;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String label = onJob ? l10n.availabilityBusy : (online ? l10n.availabilityOnline : l10n.availabilityOffline);
    final Color background = online ? colors.accent : TamamBrand.purple700;
    final Color foreground = online ? colors.textOnAccent : TamamBrand.purple100;

    return Semantics(
      button: true,
      toggled: online,
      label: l10n.availabilityToggleSemantics(label),
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(TamamRadius.pill),
        child: InkWell(
          key: const Key('availability-toggle'),
          onTap: busy ? null : onTap,
          borderRadius: BorderRadius.circular(TamamRadius.pill),
          child: AnimatedContainer(
            duration: TamamMotion.durationBase,
            height: TamamSize.buttonHeightLg,
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                AnimatedAlign(
                  duration: TamamMotion.durationBase,
                  alignment: online ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                  child: Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: online ? TamamBrand.purple900 : TamamBrand.purple500,
                      shape: BoxShape.circle,
                    ),
                    child: busy
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: foreground),
                          )
                        : Icon(
                            online ? Icons.bolt_rounded : Icons.power_settings_new_rounded,
                            size: TamamSize.iconMd,
                            color: online ? colors.accent : TamamBrand.purple100,
                          ),
                  ),
                ),
                const SizedBox(width: TamamSpacing.s2),
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: TamamSpacing.s2),
                  child: Text(
                    label,
                    style: TamamType.labelLg.toTextStyle(color: foreground).copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
