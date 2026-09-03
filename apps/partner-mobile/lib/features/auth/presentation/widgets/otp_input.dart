import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Six-digit code entry.
///
/// One real [TextField] drives six drawn boxes: the caret advances by itself,
/// paste and SMS autofill work, and there is no focus juggling to get wrong.
class OtpInput extends StatefulWidget {
  const OtpInput({
    required this.onChanged,
    required this.onCompleted,
    super.key,
    this.length = 6,
    this.hasError = false,
    this.enabled = true,
  });

  final ValueChanged<String> onChanged;

  /// Fires once the last digit is entered — the screen submits immediately.
  final ValueChanged<String> onCompleted;
  final int length;
  final bool hasError;
  final bool enabled;

  @override
  State<OtpInput> createState() => OtpInputState();
}

class OtpInputState extends State<OtpInput> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChanged);
    _focusNode.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onChanged)
      ..dispose();
    _focusNode
      ..removeListener(_onFocusChanged)
      ..dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted) setState(() {});
  }

  /// Lets the screen clear the field after a wrong code.
  void clear() => _controller.clear();

  void _onChanged() {
    final String value = _controller.text;
    widget.onChanged(value);
    if (value.length == widget.length) widget.onCompleted(value);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        // The real field is invisible but focusable, sized to cover the boxes.
        Opacity(
          opacity: 0,
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            enabled: widget.enabled,
            autofocus: true,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            autofillHints: const <String>[AutofillHints.oneTimeCode],
            inputFormatters: <TextInputFormatter>[
              LengthLimitingTextInputFormatter(widget.length),
              _OtpDigitsFormatter(),
            ],
          ),
        ),
        GestureDetector(
          onTap: widget.enabled ? () => _focusNode.requestFocus() : null,
          behavior: HitTestBehavior.opaque,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            textDirection: TextDirection.ltr,
            children: List<Widget>.generate(widget.length, _box),
          ),
        ),
      ],
    );
  }

  Widget _box(int index) {
    final TamamColors colors = context.colors;
    final String text = _controller.text;
    final bool filled = index < text.length;
    final bool active = _focusNode.hasFocus && index == text.length;
    final Color border = widget.hasError
        ? colors.danger
        : active
            ? colors.primary
            : colors.border;

    return AnimatedContainer(
      duration: TamamMotion.durationFast,
      width: 46,
      height: TamamSize.inputHeight,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(TamamRadius.button),
        border: Border.all(color: border, width: active || widget.hasError ? 1.6 : 1),
      ),
      child: Text(
        filled ? text[index] : '',
        style: TamamType.headingLg.toTextStyle(color: colors.textPrimary),
      ),
    );
  }
}

/// Accepts ASCII and Eastern-Arabic digits, storing ASCII.
class _OtpDigitsFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final String digits = PhoneFormatter.digitsOnly(newValue.text);
    if (digits == newValue.text) return newValue;
    return TextEditingValue(text: digits, selection: TextSelection.collapsed(offset: digits.length));
  }
}
