import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Phone entry with a dial-code selector, defaulting to Palestine (+970).
///
/// The field always hands the caller a full E.164 string, so no screen has to
/// know about trunk zeros or Eastern-Arabic digits.
class PhoneField extends StatefulWidget {
  const PhoneField({
    required this.onChanged,
    super.key,
    this.initialValue,
    this.label,
    this.hint,
    this.errorText,
    this.enabled = true,
    this.autofocus = false,
    this.onSubmitted,
  });

  /// Receives the E.164 value, or `null` while it is incomplete.
  final ValueChanged<String?> onChanged;

  /// A previously stored E.164 number to pre-fill.
  final String? initialValue;
  final String? label;
  final String? hint;
  final String? errorText;
  final bool enabled;
  final bool autofocus;
  final VoidCallback? onSubmitted;

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  late DialCode _dialCode;
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final String? initial = widget.initialValue;
    if (initial != null && initial.isNotEmpty) {
      final ({DialCode dialCode, String national}) parts = PhoneFormatter.split(initial);
      _dialCode = parts.dialCode;
      _controller = TextEditingController(text: parts.national);
    } else {
      _dialCode = PhoneFormatter.palestine;
      _controller = TextEditingController();
    }
    _controller.addListener(_emit);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_emit)
      ..dispose();
    super.dispose();
  }

  void _emit() {
    final String e164 = PhoneFormatter.toE164(_dialCode, _controller.text);
    widget.onChanged(PhoneFormatter.isValidE164(e164) ? e164 : null);
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return TextField(
      controller: _controller,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      onSubmitted: (String _) => widget.onSubmitted?.call(),
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩۰-۹]')),
        LengthLimitingTextInputFormatter(12),
        _AsciiDigitsFormatter(),
      ],
      style: TamamType.bodyLg.toTextStyle(color: colors.textPrimary),
      // Numbers stay left-to-right even inside an RTL layout.
      textDirection: TextDirection.ltr,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        errorText: widget.errorText,
        constraints: const BoxConstraints(minHeight: TamamSize.inputHeight),
        prefixIcon: Padding(
          padding: const EdgeInsetsDirectional.only(start: TamamSpacing.s3, end: TamamSpacing.s2),
          child: _DialCodePicker(
            value: _dialCode,
            enabled: widget.enabled,
            onChanged: (DialCode next) {
              setState(() => _dialCode = next);
              _emit();
            },
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 96, minHeight: TamamSize.inputHeight),
      ),
    );
  }
}

class _DialCodePicker extends StatelessWidget {
  const _DialCodePicker({required this.value, required this.onChanged, required this.enabled});

  final DialCode value;
  final ValueChanged<DialCode> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return DropdownButtonHideUnderline(
      child: DropdownButton<DialCode>(
        value: value,
        onChanged: enabled
            ? (DialCode? next) {
                if (next != null) onChanged(next);
              }
            : null,
        isDense: true,
        borderRadius: BorderRadius.circular(TamamRadius.md),
        icon: Icon(Icons.expand_more_rounded, size: TamamSize.iconSm, color: colors.textSecondary),
        items: PhoneFormatter.supported
            .map(
              (DialCode code) => DropdownMenuItem<DialCode>(
                value: code,
                child: Text(
                  '${code.code} ',
                  textDirection: TextDirection.ltr,
                  style: TamamType.bodyLg.toTextStyle(color: colors.textPrimary),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

/// Normalises Eastern-Arabic digits to ASCII as the customer types.
class _AsciiDigitsFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final String normalised = PhoneFormatter.digitsOnly(newValue.text);
    if (normalised == newValue.text) return newValue;
    return TextEditingValue(
      text: normalised,
      selection: TextSelection.collapsed(offset: normalised.length),
    );
  }
}
