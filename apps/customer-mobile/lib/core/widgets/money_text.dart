import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/format/money_formatter.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';

/// Renders a server-provided [Money] value with the price type scale.
///
/// Prices are never computed on the client — this widget only formats.
class MoneyText extends ConsumerWidget {
  const MoneyText(
    this.money, {
    super.key,
    this.style,
    this.color,
    this.emphasis = MoneyEmphasis.strong,
    this.signed = false,
    this.compact = false,
  });

  final Money money;
  final TextStyle? style;
  final Color? color;
  final MoneyEmphasis emphasis;

  /// Prefixes `+`/`-`; used in wallet statements.
  final bool signed;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MoneyFormatter formatter = ref.watch(moneyFormatterProvider);
    final TamamColors colors = context.colors;
    final String text = signed
        ? formatter.formatSigned(money)
        : compact
            ? formatter.formatCompact(money)
            : formatter.format(money);

    final Color resolved = color ??
        (signed && money.isNegative
            ? colors.danger
            : signed
                ? colors.success
                : colors.textPrimary);

    final TextStyle base = switch (emphasis) {
      MoneyEmphasis.strong => TamamType.price.toTextStyle(color: resolved),
      MoneyEmphasis.medium => TamamType.headingSm.toTextStyle(color: resolved).copyWith(fontWeight: FontWeight.w800),
      MoneyEmphasis.subtle => TamamType.bodyMd.toTextStyle(color: resolved).copyWith(fontWeight: FontWeight.w600),
    };

    return Text(
      text,
      style: base.merge(style),
      textDirection: TextDirection.ltr,
      semanticsLabel: text,
    );
  }
}

enum MoneyEmphasis { strong, medium, subtle }
