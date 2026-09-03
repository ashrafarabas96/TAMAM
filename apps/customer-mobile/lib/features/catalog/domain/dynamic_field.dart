import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/localized_text.dart';

/// One choice of a SELECT / MULTI_SELECT field.
class DynamicFieldOption {
  const DynamicFieldOption({required this.value, required this.label});

  factory DynamicFieldOption.fromJson(JsonMap json) => DynamicFieldOption(
        value: readStringOr(json, 'value', ''),
        label: LocalizedText.required(json, 'label'),
      );

  final String value;
  final LocalizedText label;
}

/// A category-specific question the customer answers when ordering
/// (`DynamicFieldDto`). The server re-validates every answer, so this model
/// exists to *render* the form and give immediate feedback — never to be the
/// only gate.
class DynamicField {
  const DynamicField({
    required this.key,
    required this.type,
    required this.label,
    required this.required,
    required this.sortOrder,
    this.placeholder,
    this.options = const <DynamicFieldOption>[],
    this.min,
    this.max,
    this.maxItems,
  });

  factory DynamicField.fromJson(JsonMap json) => DynamicField(
        key: readStringOr(json, 'key', ''),
        type: DynamicFieldType.fromValue(readString(json, 'type')) ?? DynamicFieldType.text,
        label: LocalizedText.required(json, 'label'),
        required: readBoolOr(json, 'required', false),
        sortOrder: readIntOr(json, 'sortOrder', 0),
        placeholder: LocalizedText.maybe(json, 'placeholder'),
        options: readList<DynamicFieldOption>(json, 'options', DynamicFieldOption.fromJson),
        min: readDouble(json, 'min'),
        max: readDouble(json, 'max'),
        maxItems: readInt(json, 'maxItems'),
      );

  final String key;
  final DynamicFieldType type;
  final LocalizedText label;
  final bool required;
  final int sortOrder;
  final LocalizedText? placeholder;
  final List<DynamicFieldOption> options;
  final double? min;
  final double? max;
  final int? maxItems;

  /// Media-backed fields are collected with the attachment picker, not the form.
  bool get isMedia =>
      type == DynamicFieldType.image ||
      type == DynamicFieldType.images ||
      type == DynamicFieldType.video ||
      type == DynamicFieldType.audio;
}

/// The outcome of validating one dynamic-field answer.
enum DynamicFieldError { none, required, tooSmall, tooLarge, tooManyItems, notANumber, invalidOption }

/// Client-side mirror of the server's `validateDynamicFields`.
///
/// Kept deliberately close to the API rules so the customer sees the problem
/// before the request is sent; the server remains the authority.
abstract final class DynamicFieldValidator {
  static DynamicFieldError validate(DynamicField field, Object? value) {
    final bool empty = value == null ||
        (value is String && value.trim().isEmpty) ||
        (value is List && value.isEmpty);
    if (empty) return field.required ? DynamicFieldError.required : DynamicFieldError.none;

    switch (field.type) {
      case DynamicFieldType.number:
        final double? number = value is num ? value.toDouble() : double.tryParse(value.toString());
        if (number == null) return DynamicFieldError.notANumber;
        if (field.min != null && number < field.min!) return DynamicFieldError.tooSmall;
        if (field.max != null && number > field.max!) return DynamicFieldError.tooLarge;
        return DynamicFieldError.none;

      case DynamicFieldType.text:
      case DynamicFieldType.textarea:
        final int length = value.toString().trim().length;
        if (field.min != null && length < field.min!) return DynamicFieldError.tooSmall;
        if (field.max != null && length > field.max!) return DynamicFieldError.tooLarge;
        return DynamicFieldError.none;

      case DynamicFieldType.select:
        final bool known = field.options.any((DynamicFieldOption o) => o.value == value.toString());
        return known ? DynamicFieldError.none : DynamicFieldError.invalidOption;

      case DynamicFieldType.multiSelect:
        if (value is! List) return DynamicFieldError.invalidOption;
        if (field.maxItems != null && value.length > field.maxItems!) return DynamicFieldError.tooManyItems;
        final Set<String> allowed = field.options.map((DynamicFieldOption o) => o.value).toSet();
        final bool allKnown = value.every((Object? v) => allowed.contains(v.toString()));
        return allKnown ? DynamicFieldError.none : DynamicFieldError.invalidOption;

      case DynamicFieldType.images:
      case DynamicFieldType.video:
      case DynamicFieldType.audio:
      case DynamicFieldType.image:
        if (value is List && field.maxItems != null && value.length > field.maxItems!) {
          return DynamicFieldError.tooManyItems;
        }
        return DynamicFieldError.none;

      case DynamicFieldType.boolean:
      case DynamicFieldType.date:
      case DynamicFieldType.time:
        return DynamicFieldError.none;
    }
  }

  /// Validates a whole answer set, returning the failing fields by key.
  static Map<String, DynamicFieldError> validateAll(
    List<DynamicField> fields,
    Map<String, Object?> values,
  ) {
    final Map<String, DynamicFieldError> errors = <String, DynamicFieldError>{};
    for (final DynamicField field in fields) {
      final DynamicFieldError error = validate(field, values[field.key]);
      if (error != DynamicFieldError.none) errors[field.key] = error;
    }
    return errors;
  }
}
