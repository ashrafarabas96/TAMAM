import 'package:flutter/material.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Snackbars and confirmation sheets, so tone and shape stay consistent.
abstract final class AppFeedback {
  static void showMessage(BuildContext context, String message, {IconData? icon}) {
    final TamamColors colors = context.colors;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: TamamSize.iconMd, color: colors.accent),
                const SizedBox(width: TamamSpacing.s2),
              ],
              Expanded(child: Text(message)),
            ],
          ),
          duration: const Duration(seconds: 3),
        ),
      );
  }

  static void showFailure(BuildContext context, AppFailure failure) =>
      showMessage(context, localizedFailure(context.l10n, failure), icon: Icons.error_outline_rounded);

  /// A bottom-sheet confirmation with the destructive action styled as such.
  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    required String message,
    required String confirmLabel,
    String? cancelLabel,
    bool destructive = false,
  }) async {
    final AppLocalizations l10n = context.l10n;
    final bool? result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            TamamSpacing.s5,
            TamamSpacing.s2,
            TamamSpacing.s5,
            TamamSpacing.s5,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                title,
                style: TamamType.headingMd.toTextStyle(color: sheetContext.colors.textPrimary),
              ),
              const SizedBox(height: TamamSpacing.s2),
              Text(
                message,
                style: TamamType.bodyMd.toTextStyle(color: sheetContext.colors.textSecondary),
              ),
              const SizedBox(height: TamamSpacing.s6),
              TamamButton(
                label: confirmLabel,
                variant: destructive ? TamamButtonVariant.danger : TamamButtonVariant.primary,
                onPressed: () => Navigator.of(sheetContext).pop(true),
              ),
              const SizedBox(height: TamamSpacing.s2),
              TamamButton(
                label: cancelLabel ?? l10n.actionCancel,
                variant: TamamButtonVariant.ghost,
                onPressed: () => Navigator.of(sheetContext).pop(false),
              ),
            ],
          ),
        ),
      ),
    );
    return result ?? false;
  }
}
