import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';

/// The illustrated "nothing here yet" block.
///
/// Illustrations are drawn from theme colours and a Material icon rather than
/// bitmaps, so they follow light/dark automatically and add nothing to the
/// bundle size.
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.title,
    super.key,
    this.message,
    this.icon = Icons.inbox_rounded,
    this.actionLabel,
    this.onAction,
    this.tone = EmptyStateTone.neutral,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EmptyStateTone tone;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final Color accent = switch (tone) {
      EmptyStateTone.neutral => colors.primary,
      EmptyStateTone.warning => colors.warning,
      EmptyStateTone.danger => colors.danger,
    };
    final Color soft = switch (tone) {
      EmptyStateTone.neutral => colors.surfaceBrandSoft,
      EmptyStateTone.warning => colors.warningSoft,
      EmptyStateTone.danger => colors.dangerSoft,
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s6, vertical: TamamSpacing.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(color: soft, shape: BoxShape.circle),
              child: Icon(icon, size: 44, color: accent),
            ),
            const SizedBox(height: TamamSpacing.s5),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
            ),
            if (message != null) ...<Widget>[
              const SizedBox(height: TamamSpacing.s2),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
              ),
            ],
            if (actionLabel != null && onAction != null) ...<Widget>[
              const SizedBox(height: TamamSpacing.s6),
              SizedBox(
                width: 220,
                child: TamamButton(
                  label: actionLabel!,
                  onPressed: onAction,
                  variant: TamamButtonVariant.secondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum EmptyStateTone { neutral, warning, danger }
