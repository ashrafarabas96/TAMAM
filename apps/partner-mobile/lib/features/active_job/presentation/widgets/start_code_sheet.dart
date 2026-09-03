import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/pin_input.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Asks for the code the customer holds: the 4-digit trip PIN (RIDE), the
/// pickup OTP (DELIVERY) or the delivery OTP (proof of delivery).
///
/// Returns the code, or `null` when dismissed. Validation happens server-side;
/// [errorText] lets the caller reopen the sheet with the rejection shown.
class StartCodeSheet extends StatefulWidget {
  const StartCodeSheet({
    required this.title,
    required this.subtitle,
    required this.length,
    super.key,
    this.errorText,
  });

  final String title;
  final String subtitle;
  final int length;
  final String? errorText;

  static Future<String?> show(
    BuildContext context, {
    required String title,
    required String subtitle,
    int length = 4,
    String? errorText,
  }) =>
      SheetScaffold.show<String>(
        context,
        (BuildContext _) => StartCodeSheet(title: title, subtitle: subtitle, length: length, errorText: errorText),
      );

  @override
  State<StartCodeSheet> createState() => _StartCodeSheetState();
}

class _StartCodeSheetState extends State<StartCodeSheet> {
  String _code = '';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    return SheetScaffold(
      title: widget.title,
      subtitle: widget.subtitle,
      scrollable: false,
      footer: TamamButton(
        label: l10n.actionConfirm,
        onPressed: _code.length == widget.length ? () => Navigator.of(context).pop(_code) : null,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const SizedBox(height: TamamSpacing.s3),
          PinInput(
            length: widget.length,
            hasError: widget.errorText != null,
            onChanged: (String value) => setState(() => _code = value),
            onCompleted: (String value) => Navigator.of(context).pop(value),
          ),
          if (widget.errorText != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            Text(widget.errorText!, style: TamamType.bodySm.toTextStyle(color: colors.danger)),
          ],
          const SizedBox(height: TamamSpacing.s3),
        ],
      ),
    );
  }
}
