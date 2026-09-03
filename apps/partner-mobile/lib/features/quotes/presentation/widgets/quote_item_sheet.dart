import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_partner/core/format/money_formatter.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/features/quotes/domain/quote_draft.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Converts what a partner types ("35", "35.5", "٣٥٫٥") into integer minor
/// units for [currency]. Returns `null` for anything that is not a number.
int? parseMajorToMinor(String raw, String currency) {
  final String normalised = raw.trim().replaceAll('٫', '.').replaceAll(',', '.');
  final StringBuffer ascii = StringBuffer();
  for (final int rune in normalised.runes) {
    if (rune == 0x2E) {
      ascii.write('.');
    } else {
      ascii.write(PhoneFormatter.digitsOnly(String.fromCharCode(rune)));
    }
  }
  final String text = ascii.toString();
  if (text.isEmpty || text == '.') return null;
  final int decimals = MoneyFormatter.decimalsFor(currency);
  final List<String> parts = text.split('.');
  if (parts.length > 2) return null;
  final int whole = int.tryParse(parts[0].isEmpty ? '0' : parts[0]) ?? -1;
  if (whole < 0) return null;
  String fraction = parts.length == 2 ? parts[1] : '';
  if (fraction.length > decimals) fraction = fraction.substring(0, decimals);
  while (fraction.length < decimals) {
    fraction = '${fraction}0';
  }
  final int fractionValue = fraction.isEmpty ? 0 : (int.tryParse(fraction) ?? 0);
  int scale = 1;
  for (int i = 0; i < decimals; i++) {
    scale *= 10;
  }
  return whole * scale + fractionValue;
}

/// Formats minor units back into an editable major-unit string ("35.50").
String minorToEditable(int minor, String currency) {
  final int decimals = MoneyFormatter.decimalsFor(currency);
  if (decimals == 0) return '$minor';
  int scale = 1;
  for (int i = 0; i < decimals; i++) {
    scale *= 10;
  }
  final int whole = minor ~/ scale;
  final String fraction = (minor % scale).toString().padLeft(decimals, '0');
  return '$whole.$fraction';
}

/// Parses a decimal quantity ("1", "2.5", "٢٫٥").
double? parseQuantity(String raw) {
  final String text = raw.trim().replaceAll('٫', '.').replaceAll(',', '.');
  final StringBuffer ascii = StringBuffer();
  for (final int rune in text.runes) {
    if (rune == 0x2E) {
      ascii.write('.');
    } else {
      ascii.write(PhoneFormatter.digitsOnly(String.fromCharCode(rune)));
    }
  }
  final double? value = double.tryParse(ascii.toString());
  if (value == null || value <= 0 || value > 10000) return null;
  return value;
}

/// Add / edit one quote line.
class QuoteItemSheet extends StatefulWidget {
  const QuoteItemSheet({required this.currency, super.key, this.initial});

  final String currency;
  final QuoteDraftItem? initial;

  static Future<QuoteDraftItem?> show(BuildContext context, {required String currency, QuoteDraftItem? initial}) =>
      SheetScaffold.show<QuoteDraftItem>(
        context,
        (BuildContext _) => QuoteItemSheet(currency: currency, initial: initial),
      );

  @override
  State<QuoteItemSheet> createState() => _QuoteItemSheetState();
}

class _QuoteItemSheetState extends State<QuoteItemSheet> {
  late QuoteItemKind _kind = widget.initial?.kind ?? QuoteItemKind.labor;
  late final TextEditingController _description = TextEditingController(text: widget.initial?.description ?? '');
  late final TextEditingController _quantity =
      TextEditingController(text: widget.initial == null ? '1' : _trimQuantity(widget.initial!.quantity));
  late final TextEditingController _price = TextEditingController(
    text: widget.initial == null ? '' : minorToEditable(widget.initial!.unitPriceMinor, widget.currency),
  );

  @override
  void dispose() {
    _description.dispose();
    _quantity.dispose();
    _price.dispose();
    super.dispose();
  }

  static String _trimQuantity(double value) =>
      value == value.roundToDouble() ? value.toInt().toString() : value.toString();

  QuoteDraftItem? get _item {
    final double? quantity = parseQuantity(_quantity.text);
    final int? price = parseMajorToMinor(_price.text, widget.currency);
    if (quantity == null || price == null) return null;
    final QuoteDraftItem item = QuoteDraftItem(
      kind: _kind,
      description: _description.text.trim(),
      quantity: quantity,
      unitPriceMinor: price,
    );
    return item.isComplete ? item : null;
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final QuoteDraftItem? item = _item;
    final String symbol = MoneyFormatter.symbolFor(widget.currency);

    return SheetScaffold(
      title: widget.initial == null ? l10n.quoteAddItem : l10n.quoteEditItem,
      footer: TamamButton(
        label: widget.initial == null ? l10n.actionAdd : l10n.actionSave,
        onPressed: item == null ? null : () => Navigator.of(context).pop(item),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SegmentedButton<QuoteItemKind>(
            segments: <ButtonSegment<QuoteItemKind>>[
              ButtonSegment<QuoteItemKind>(value: QuoteItemKind.labor, label: Text(l10n.quoteKindLabor)),
              ButtonSegment<QuoteItemKind>(value: QuoteItemKind.parts, label: Text(l10n.quoteKindParts)),
              ButtonSegment<QuoteItemKind>(value: QuoteItemKind.fee, label: Text(l10n.quoteKindFee)),
            ],
            selected: <QuoteItemKind>{_kind},
            onSelectionChanged: (Set<QuoteItemKind> next) => setState(() => _kind = next.first),
          ),
          const SizedBox(height: TamamSpacing.s4),
          TextField(
            controller: _description,
            autofocus: widget.initial == null,
            textCapitalization: TextCapitalization.sentences,
            maxLength: 200,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.quoteItemDescription, counterText: ''),
          ),
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: _quantity,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  textDirection: TextDirection.ltr,
                  inputFormatters: <TextInputFormatter>[FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,٫]'))],
                  onChanged: (String _) => setState(() {}),
                  decoration: InputDecoration(labelText: l10n.quoteItemQuantity),
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _price,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  textDirection: TextDirection.ltr,
                  inputFormatters: <TextInputFormatter>[FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,٫]'))],
                  onChanged: (String _) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: l10n.quoteItemUnitPrice,
                    suffixText: symbol,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          if (item != null)
            Text(
              l10n.quoteLineTotal(
                MoneyFormatter(Localizations.localeOf(context).toLanguageTag())
                    .format(Money(amount: item.lineTotalMinor, currency: widget.currency)),
              ),
              textAlign: TextAlign.end,
              style: TamamType.labelLg.toTextStyle(color: colors.textSecondary),
            ),
        ],
      ),
    );
  }
}
