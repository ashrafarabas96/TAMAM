import 'dart:async';

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/media/presentation/widgets/attachment_picker.dart';
import 'package:tamam_partner/features/vehicles/data/vehicles_repository.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The vehicle fields shared by the onboarding step and "add a vehicle".
///
/// It reports a complete [VehicleInput] (or `null`) through [onChanged]; the
/// hosting screen owns the submit button and the API call, because the two
/// callers post to different endpoints.
class VehicleForm extends ConsumerStatefulWidget {
  const VehicleForm({required this.onChanged, super.key, this.initial, this.fieldErrors});

  final ValueChanged<VehicleInput?> onChanged;
  final Vehicle? initial;

  /// Field-level errors from the last rejected submission.
  final String? Function(String field)? fieldErrors;

  @override
  ConsumerState<VehicleForm> createState() => _VehicleFormState();
}

class _VehicleFormState extends ConsumerState<VehicleForm> {
  late final TextEditingController _brand = TextEditingController(text: widget.initial?.brand ?? '');
  late final TextEditingController _model = TextEditingController(text: widget.initial?.model ?? '');
  late final TextEditingController _color = TextEditingController(text: widget.initial?.color ?? '');
  late final TextEditingController _plate = TextEditingController(text: widget.initial?.plate ?? '');
  late final TextEditingController _year =
      TextEditingController(text: widget.initial == null ? '' : '${widget.initial!.year}');
  late String? _vehicleTypeId = widget.initial?.vehicleTypeId;
  late int _seats = widget.initial?.seats ?? 4;
  List<Attachment> _photos = <Attachment>[];

  @override
  void initState() {
    super.initState();
    for (final TextEditingController controller in <TextEditingController>[_brand, _model, _color, _plate, _year]) {
      controller.addListener(_emit);
    }
  }

  @override
  void dispose() {
    for (final TextEditingController controller in <TextEditingController>[_brand, _model, _color, _plate, _year]) {
      controller
        ..removeListener(_emit)
        ..dispose();
    }
    super.dispose();
  }

  void _emit() {
    widget.onChanged(_build());
    if (mounted) setState(() {});
  }

  VehicleInput? _build() {
    final String? typeId = _vehicleTypeId;
    final int? year = int.tryParse(PhoneFormatter.digitsOnly(_year.text));
    final List<String> mediaIds =
        _photos.where((Attachment a) => a.isReady).map((Attachment a) => a.mediaId!).toList(growable: false);
    final int thisYear = DateTime.now().year;
    if (typeId == null ||
        _brand.text.trim().isEmpty ||
        _model.text.trim().isEmpty ||
        _color.text.trim().length < 2 ||
        _plate.text.trim().length < 2 ||
        year == null ||
        year < 1990 ||
        year > thisYear + 1 ||
        mediaIds.isEmpty) {
      return null;
    }
    return VehicleInput(
      vehicleTypeId: typeId,
      brand: _brand.text,
      model: _model.text,
      year: year,
      color: _color.text,
      plate: _plate.text,
      seats: _seats,
      photoMediaIds: mediaIds,
    );
  }

  Future<void> _addPhotos({required bool fromCamera}) async {
    final MediaRepository media = ref.read(mediaRepositoryProvider);
    final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: 6 - _photos.length);
    if (picked.isEmpty || !mounted) return;
    setState(() => _photos = <Attachment>[..._photos, ...picked.map((Attachment a) => a.copyWith(uploading: true))]);
    for (final Attachment attachment in picked) {
      try {
        final Attachment uploaded = await media.upload(attachment, purpose: MediaPurpose.vehiclePhoto);
        _replace(attachment.localPath, uploaded);
      } on Object catch (error) {
        _replace(attachment.localPath, attachment.copyWith(uploading: false, failed: true));
        if (mounted) AppFeedback.showFailure(context, asFailure(error));
      }
    }
  }

  void _replace(String path, Attachment next) {
    if (!mounted) return;
    setState(() => _photos = _photos.map((Attachment a) => a.localPath == path ? next : a).toList(growable: false));
    _emit();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;
    final AsyncValue<List<VehicleType>> types = ref.watch(vehicleTypesProvider);
    final String? Function(String field)? errors = widget.fieldErrors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        types.when(
          loading: () => const LinearProgressIndicator(),
          error: (Object error, StackTrace _) => Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  localizedFailure(l10n, asFailure(error)),
                  style: TamamType.bodySm.toTextStyle(color: colors.danger),
                ),
              ),
              TextButton(onPressed: () => ref.invalidate(vehicleTypesProvider), child: Text(l10n.actionRetry)),
            ],
          ),
          data: (List<VehicleType> list) => DropdownButtonFormField<String>(
            initialValue: _vehicleTypeId,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: l10n.vehicleType,
              errorText: errors?.call('vehicleTypeId'),
            ),
            items: list
                .map(
                  (VehicleType type) => DropdownMenuItem<String>(
                    value: type.id,
                    child: Text(type.name.resolve(language), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(growable: false),
            onChanged: (String? value) {
              setState(() {
                _vehicleTypeId = value;
                final VehicleType? type = list.where((VehicleType t) => t.id == value).firstOrNull;
                if (type != null) _seats = type.seats;
              });
              _emit();
            },
          ),
        ),
        const SizedBox(height: TamamSpacing.s3),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _brand,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l10n.vehicleBrand, errorText: errors?.call('brand')),
              ),
            ),
            const SizedBox(width: TamamSpacing.s3),
            Expanded(
              child: TextField(
                controller: _model,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l10n.vehicleModel, errorText: errors?.call('model')),
              ),
            ),
          ],
        ),
        const SizedBox(height: TamamSpacing.s3),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _year,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]')),
                  LengthLimitingTextInputFormatter(4),
                ],
                decoration: InputDecoration(labelText: l10n.vehicleYear, errorText: errors?.call('year')),
              ),
            ),
            const SizedBox(width: TamamSpacing.s3),
            Expanded(
              child: TextField(
                controller: _color,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l10n.vehicleColor, errorText: errors?.call('color')),
              ),
            ),
          ],
        ),
        const SizedBox(height: TamamSpacing.s3),
        TextField(
          controller: _plate,
          textDirection: TextDirection.ltr,
          textCapitalization: TextCapitalization.characters,
          decoration: InputDecoration(labelText: l10n.vehiclePlate, errorText: errors?.call('plate')),
        ),
        const SizedBox(height: TamamSpacing.s3),
        Row(
          children: <Widget>[
            Expanded(child: Text(l10n.vehicleSeats, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary))),
            IconButton(
              onPressed: _seats <= 1
                  ? null
                  : () {
                      setState(() => _seats--);
                      _emit();
                    },
              icon: const Icon(Icons.remove_circle_outline_rounded),
            ),
            Text('$_seats', textDirection: TextDirection.ltr, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
            IconButton(
              onPressed: _seats >= 60
                  ? null
                  : () {
                      setState(() => _seats++);
                      _emit();
                    },
              icon: const Icon(Icons.add_circle_outline_rounded),
            ),
          ],
        ),
        const SizedBox(height: TamamSpacing.s3),
        AttachmentPicker(
          attachments: _photos,
          label: l10n.vehiclePhotos,
          hint: l10n.vehiclePhotosHint,
          onAdd: ({required bool fromCamera}) => unawaited(_addPhotos(fromCamera: fromCamera)),
          onRemove: (String path) {
            setState(() => _photos = _photos.where((Attachment a) => a.localPath != path).toList(growable: false));
            _emit();
          },
        ),
      ],
    );
  }
}
