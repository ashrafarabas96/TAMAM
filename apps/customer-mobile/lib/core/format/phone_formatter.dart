/// One dial code the phone field offers.
class DialCode {
  const DialCode({required this.iso, required this.code, required this.nationalLength});

  final String iso;

  /// Including the leading `+`.
  final String code;

  /// Expected digit count after the dial code (used only for the length hint).
  final int nationalLength;
}

/// E.164 helpers for the launch region.
///
/// The API accepts any E.164 number; Palestine is simply the default because
/// that is where the platform launches.
abstract final class PhoneFormatter {
  static const DialCode palestine = DialCode(iso: 'PS', code: '+970', nationalLength: 9);
  static const DialCode israel = DialCode(iso: 'IL', code: '+972', nationalLength: 9);
  static const DialCode jordan = DialCode(iso: 'JO', code: '+962', nationalLength: 9);

  static const List<DialCode> supported = <DialCode>[palestine, israel, jordan];

  /// Joins a dial code and a locally typed number into E.164, dropping the
  /// trunk `0` people habitually type (`0599…` → `+970599…`).
  static String toE164(DialCode dialCode, String national) {
    final String digits = digitsOnly(national).replaceFirst(RegExp(r'^0+'), '');
    return '${dialCode.code}$digits';
  }

  /// Keeps ASCII digits only, converting Eastern-Arabic numerals people paste
  /// from messaging apps.
  static String digitsOnly(String input) {
    final StringBuffer buffer = StringBuffer();
    for (final int rune in input.runes) {
      if (rune >= 0x30 && rune <= 0x39) {
        buffer.writeCharCode(rune);
      } else if (rune >= 0x0660 && rune <= 0x0669) {
        buffer.writeCharCode(rune - 0x0660 + 0x30);
      } else if (rune >= 0x06F0 && rune <= 0x06F9) {
        buffer.writeCharCode(rune - 0x06F0 + 0x30);
      }
    }
    return buffer.toString();
  }

  static bool isValidE164(String value) => RegExp(r'^\+[1-9]\d{6,14}$').hasMatch(value);

  /// Splits a stored E.164 number back into a dial code + national part so the
  /// field can be pre-filled from the profile.
  static ({DialCode dialCode, String national}) split(String e164) {
    for (final DialCode candidate in supported) {
      if (e164.startsWith(candidate.code)) {
        return (dialCode: candidate, national: e164.substring(candidate.code.length));
      }
    }
    return (dialCode: palestine, national: digitsOnly(e164));
  }

  /// `+970 599 123 456` — grouped for readability, never sent to the API.
  static String pretty(String e164) {
    final ({DialCode dialCode, String national}) parts = split(e164);
    final String n = parts.national;
    if (n.length < 6) return e164;
    final int head = n.length - 6;
    return '${parts.dialCode.code} ${n.substring(0, head)} ${n.substring(head, head + 3)} ${n.substring(head + 3)}'
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }
}
