import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Fixed-length numeric entry for the trip PIN and the pickup/delivery OTP.
///
/// One real [TextField] drives the drawn boxes, so paste and the numeric keypad
/// behave normally and there is no per-box focus juggling to get wrong.
class PinInput extends StatefulWidget {
  const PinInput({
    required this.onChanged,
    required this.onCompleted,
    super.key,
    this.length = 4,
    this.hasError = false,
    this.enabled = true,
    this.autofocus = true,
  });

  final ValueChanged<String> onChanged;

  /// Fires once the last digit is entered — the sheet submits immediately.
  final ValueChanged<String> onCompleted;
  final int length;
  final bool hasError;
  final bool enabled;
  final bool autofocus;

  @override
  State<PinInput> createState() => PinInputState();
}

class PinInputState extends State<PinInput> {
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

  /// Lets the sheet clear the field after the server rejected the code.
  void clear() => _controller.clear();

  void _onFocusChanged() {
    if (mounted) setState(() {});
  }

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
        Opacity(
          opacity: 0,
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            enabled: widget.enabled,
            autofocus: widget.autofocus,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            inputFormatters: <TextInputFormatter>[
              LengthLimitingTextInputFormatter(widget.length),
              _DigitsFormatter(),
            ],
          ),
        ),
        GestureDetector(
          onTap: widget.enabled ? _focusNode.requestFocus : null,
          behavior: HitTestBehavior.opaque,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
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
      width: 54,
      height: 62,
      margin: const EdgeInsets.symmetric(horizontal: TamamSpacing.s1),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(TamamRadius.button),
        border: Border.all(color: border, width: active || widget.hasError ? 1.6 : 1),
      ),
      child: Text(
        filled ? text[index] : '',
        style: TamamType.displaySm.toTextStyle(color: colors.textPrimary),
      ),
    );
  }
}

/// Accepts ASCII and Eastern-Arabic digits, storing ASCII.
class _DigitsFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final String digits = PhoneFormatter.digitsOnly(newValue.text);
    if (digits == newValue.text) return newValue;
    return TextEditingValue(text: digits, selection: TextSelection.collapsed(offset: digits.length));
  }
}
