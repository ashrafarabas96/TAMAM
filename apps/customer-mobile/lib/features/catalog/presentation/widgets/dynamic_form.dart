import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/catalog/domain/dynamic_field.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Renders a category's `requiredFields` as a form.
///
/// Every [DynamicFieldType] the contract defines has a renderer here, so a new
/// question added in the admin appears in the app without a release. Media
/// fields are intentionally delegated to the attachment picker instead.
class DynamicFieldsForm extends ConsumerWidget {
  const DynamicFieldsForm({
    required this.fields,
    required this.values,
    required this.onChanged,
    super.key,
    this.errors = const <String, DynamicFieldError>{},
  });

  final List<DynamicField> fields;
  final Map<String, Object?> values;
  final void Function(String key, Object? value) onChanged;
  final Map<String, DynamicFieldError> errors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String language = ref.watch(localeControllerProvider).languageCode;
    final List<DynamicField> visible =
        fields.where((DynamicField field) => !field.isMedia).toList(growable: false);
    if (visible.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final DynamicField field in visible)
          Padding(
            padding: const EdgeInsets.only(bottom: TamamSpacing.s4),
            child: _FieldEditor(
              field: field,
              language: language,
              value: values[field.key],
              error: errors[field.key],
              onChanged: (Object? value) => onChanged(field.key, value),
            ),
          ),
      ],
    );
  }
}

class _FieldEditor extends ConsumerWidget {
  const _FieldEditor({
    required this.field,
    required this.language,
    required this.value,
    required this.onChanged,
    this.error,
  });

  final DynamicField field;
  final String language;
  final Object? value;
  final ValueChanged<Object?> onChanged;
  final DynamicFieldError? error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String label = field.label.resolve(language) + (field.required ? ' *' : '');
    final String? hint = field.placeholder?.resolve(language);
    final String? errorText = error == null ? null : _errorText(l10n, error!, field);

    switch (field.type) {
      case DynamicFieldType.text:
        return TextFormField(
          initialValue: value?.toString(),
          decoration: InputDecoration(labelText: label, hintText: hint, errorText: errorText),
          onChanged: onChanged,
        );

      case DynamicFieldType.textarea:
        return TextFormField(
          initialValue: value?.toString(),
          maxLines: 4,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            errorText: errorText,
            alignLabelWithHint: true,
          ),
          onChanged: onChanged,
        );

      case DynamicFieldType.number:
        return TextFormField(
          initialValue: value?.toString(),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: label, hintText: hint, errorText: errorText),
          onChanged: (String raw) => onChanged(double.tryParse(raw)),
        );

      case DynamicFieldType.boolean:
        return SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: Text(label),
          subtitle: errorText == null ? null : Text(errorText),
          value: value == true,
          onChanged: onChanged,
        );

      case DynamicFieldType.select:
        return _LabeledField(
          label: label,
          errorText: errorText,
          child: Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: field.options
                .map(
                  (DynamicFieldOption option) => ChoiceChip(
                    label: Text(option.label.resolve(language)),
                    selected: value == option.value,
                    onSelected: (bool selected) => onChanged(selected ? option.value : null),
                  ),
                )
                .toList(growable: false),
          ),
        );

      case DynamicFieldType.multiSelect:
        final List<String> selected = value is List
            ? (value! as List<Object?>).map((Object? v) => v.toString()).toList()
            : <String>[];
        return _LabeledField(
          label: label,
          errorText: errorText,
          child: Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: field.options
                .map(
                  (DynamicFieldOption option) => FilterChip(
                    label: Text(option.label.resolve(language)),
                    selected: selected.contains(option.value),
                    onSelected: (bool isSelected) {
                      final List<String> next = <String>[...selected];
                      if (isSelected) {
                        next.add(option.value);
                      } else {
                        next.remove(option.value);
                      }
                      onChanged(next);
                    },
                  ),
                )
                .toList(growable: false),
          ),
        );

      case DynamicFieldType.date:
        return _PickerField(
          label: label,
          errorText: errorText,
          icon: Icons.event_rounded,
          display: value?.toString() ?? l10n.formChooseDate,
          onTap: () => unawaited(_pickDate(context)),
        );

      case DynamicFieldType.time:
        return _PickerField(
          label: label,
          errorText: errorText,
          icon: Icons.schedule_rounded,
          display: value?.toString() ?? l10n.formChooseTime,
          onTap: () => unawaited(_pickTime(context)),
        );

      case DynamicFieldType.image:
      case DynamicFieldType.images:
      case DynamicFieldType.video:
      case DynamicFieldType.audio:
        // Media questions are collected by the attachment picker on the screen.
        return const SizedBox.shrink();
    }
  }

  Future<void> _pickDate(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(value?.toString() ?? '') ?? now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) onChanged(picked.toIso8601String().substring(0, 10));
  }

  Future<void> _pickTime(BuildContext context) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked == null) return;
    final String hh = picked.hour.toString().padLeft(2, '0');
    final String mm = picked.minute.toString().padLeft(2, '0');
    onChanged('$hh:$mm');
  }

  String _errorText(AppLocalizations l10n, DynamicFieldError error, DynamicField field) {
    switch (error) {
      case DynamicFieldError.none:
        return '';
      case DynamicFieldError.required:
        return l10n.formRequired;
      case DynamicFieldError.tooSmall:
        return l10n.formTooSmall(field.min?.toString() ?? '');
      case DynamicFieldError.tooLarge:
        return l10n.formTooLarge(field.max?.toString() ?? '');
      case DynamicFieldError.tooManyItems:
        return l10n.formTooManyItems(field.maxItems ?? 0);
      case DynamicFieldError.notANumber:
        return l10n.formNotANumber;
      case DynamicFieldError.invalidOption:
        return l10n.formInvalidOption;
    }
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child, this.errorText});

  final String label;
  final Widget child;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s2),
        child,
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(top: TamamSpacing.s1),
            child: Text(
              errorText!,
              style: TamamType.bodySm.toTextStyle(color: colors.danger),
            ),
          ),
      ],
    );
  }
}

class _PickerField extends StatelessWidget {
  const _PickerField({
    required this.label,
    required this.icon,
    required this.display,
    required this.onTap,
    this.errorText,
  });

  final String label;
  final IconData icon;
  final String display;
  final VoidCallback onTap;
  final String? errorText;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TamamRadius.button),
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, errorText: errorText),
          child: Row(
            children: <Widget>[
              Icon(icon, size: TamamSize.iconMd, color: context.colors.textSecondary),
              const SizedBox(width: TamamSpacing.s2),
              Text(display, style: TamamType.bodyLg.toTextStyle(color: context.colors.textPrimary)),
            ],
          ),
        ),
      );
}

/// A read-only summary of answered dynamic fields, used on the job screen.
class DynamicFieldsSummary extends ConsumerWidget {
  const DynamicFieldsSummary({required this.fields, required this.values, super.key});

  final List<DynamicField> fields;
  final Map<String, Object?> values;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String language = ref.watch(localeControllerProvider).languageCode;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final TamamColors colors = context.colors;

    final List<Widget> rows = <Widget>[];
    for (final DynamicField field in fields) {
      final Object? value = values[field.key];
      if (value == null || (value is String && value.isEmpty)) continue;
      rows.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  field.label.resolve(language),
                  style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                ),
              ),
              Expanded(
                child: Text(
                  _display(value, units),
                  textAlign: TextAlign.end,
                  style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }

  String _display(Object value, UnitFormatter units) {
    if (value is bool) return value ? '✓' : '—';
    if (value is num) return units.number(value);
    if (value is List) return value.map((Object? v) => v.toString()).join('، ');
    return value.toString();
  }
}
