import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/features/catalog/domain/dynamic_field.dart';

DynamicField _field(
  DynamicFieldType type, {
  bool required = false,
  double? min,
  double? max,
  int? maxItems,
  List<String> options = const <String>[],
}) =>
    DynamicField(
      key: 'k',
      type: type,
      label: const LocalizedText(ar: 'حقل', en: 'Field'),
      required: required,
      sortOrder: 0,
      min: min,
      max: max,
      maxItems: maxItems,
      options: options
          .map((String v) => DynamicFieldOption(value: v, label: LocalizedText.single(v)))
          .toList(growable: false),
    );

void main() {
  group('DynamicFieldValidator', () {
    test('flags an empty required field and accepts an empty optional one', () {
      expect(
        DynamicFieldValidator.validate(_field(DynamicFieldType.text, required: true), ''),
        DynamicFieldError.required,
      );
      expect(
        DynamicFieldValidator.validate(_field(DynamicFieldType.text), null),
        DynamicFieldError.none,
      );
      expect(
        DynamicFieldValidator.validate(_field(DynamicFieldType.text, required: true), '   '),
        DynamicFieldError.required,
      );
    });

    test('checks numeric bounds and rejects non-numbers', () {
      final DynamicField field = _field(DynamicFieldType.number, min: 1, max: 10);
      expect(DynamicFieldValidator.validate(field, 5), DynamicFieldError.none);
      expect(DynamicFieldValidator.validate(field, '7.5'), DynamicFieldError.none);
      expect(DynamicFieldValidator.validate(field, 0), DynamicFieldError.tooSmall);
      expect(DynamicFieldValidator.validate(field, 11), DynamicFieldError.tooLarge);
      expect(DynamicFieldValidator.validate(field, 'abc'), DynamicFieldError.notANumber);
    });

    test('treats min/max as a character count for text', () {
      final DynamicField field = _field(DynamicFieldType.textarea, min: 5, max: 10);
      expect(DynamicFieldValidator.validate(field, 'hello'), DynamicFieldError.none);
      expect(DynamicFieldValidator.validate(field, 'hi'), DynamicFieldError.tooSmall);
      expect(DynamicFieldValidator.validate(field, 'far too long here'), DynamicFieldError.tooLarge);
    });

    test('only accepts values the server offered for SELECT', () {
      final DynamicField field = _field(DynamicFieldType.select, options: <String>['a', 'b']);
      expect(DynamicFieldValidator.validate(field, 'a'), DynamicFieldError.none);
      expect(DynamicFieldValidator.validate(field, 'z'), DynamicFieldError.invalidOption);
    });

    test('validates MULTI_SELECT membership and the item cap', () {
      final DynamicField field =
          _field(DynamicFieldType.multiSelect, options: <String>['a', 'b', 'c'], maxItems: 2);
      expect(DynamicFieldValidator.validate(field, <String>['a', 'b']), DynamicFieldError.none);
      expect(
        DynamicFieldValidator.validate(field, <String>['a', 'b', 'c']),
        DynamicFieldError.tooManyItems,
      );
      expect(DynamicFieldValidator.validate(field, <String>['a', 'z']), DynamicFieldError.invalidOption);
      expect(DynamicFieldValidator.validate(field, 'a'), DynamicFieldError.invalidOption);
    });

    test('accepts booleans, dates and times as given', () {
      expect(DynamicFieldValidator.validate(_field(DynamicFieldType.boolean), true), DynamicFieldError.none);
      expect(
        DynamicFieldValidator.validate(_field(DynamicFieldType.date), '2026-03-01'),
        DynamicFieldError.none,
      );
      expect(DynamicFieldValidator.validate(_field(DynamicFieldType.time), '09:30'), DynamicFieldError.none);
    });

    test('caps the number of attached media items', () {
      final DynamicField field = _field(DynamicFieldType.images, maxItems: 2);
      expect(DynamicFieldValidator.validate(field, <String>['a', 'b']), DynamicFieldError.none);
      expect(DynamicFieldValidator.validate(field, <String>['a', 'b', 'c']), DynamicFieldError.tooManyItems);
    });

    test('validateAll reports only the failing keys', () {
      final List<DynamicField> fields = <DynamicField>[
        DynamicField(
          key: 'brand',
          type: DynamicFieldType.text,
          label: const LocalizedText(ar: 'الماركة', en: 'Brand'),
          required: true,
          sortOrder: 0,
        ),
        DynamicField(
          key: 'age',
          type: DynamicFieldType.number,
          label: const LocalizedText(ar: 'العمر', en: 'Age'),
          required: false,
          sortOrder: 1,
          max: 30,
        ),
      ];

      final Map<String, DynamicFieldError> errors = DynamicFieldValidator.validateAll(
        fields,
        <String, Object?>{'brand': '', 'age': 45},
      );

      expect(errors.keys, containsAll(<String>['brand', 'age']));
      expect(errors['brand'], DynamicFieldError.required);
      expect(errors['age'], DynamicFieldError.tooLarge);

      final Map<String, DynamicFieldError> clean = DynamicFieldValidator.validateAll(
        fields,
        <String, Object?>{'brand': 'LG', 'age': 12},
      );
      expect(clean, isEmpty);
    });

    test('media fields are excluded from the rendered form', () {
      expect(_field(DynamicFieldType.images).isMedia, isTrue);
      expect(_field(DynamicFieldType.audio).isMedia, isTrue);
      expect(_field(DynamicFieldType.text).isMedia, isFalse);
    });
  });
}
