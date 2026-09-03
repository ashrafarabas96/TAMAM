import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/places/domain/saved_place.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Manage saved addresses: HOME and WORK are singletons, CUSTOM can repeat.
class SavedPlacesScreen extends ConsumerWidget {
  const SavedPlacesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<SavedPlace>> places = ref.watch(savedPlacesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.savedPlacesTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => unawaited(_addPlace(context, ref)),
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.savedPlacesAdd),
      ),
      body: AsyncView<List<SavedPlace>>(
        value: places,
        onRetry: () => ref.invalidate(savedPlacesProvider),
        isEmpty: (List<SavedPlace> items) => items.isEmpty,
        emptyTitle: l10n.savedPlacesEmptyTitle,
        emptyMessage: l10n.savedPlacesEmptyBody,
        emptyIcon: Icons.location_off_rounded,
        emptyActionLabel: l10n.savedPlacesAdd,
        onEmptyAction: () => unawaited(_addPlace(context, ref)),
        builder: (List<SavedPlace> items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(savedPlacesProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              TamamSpacing.s4,
              TamamSpacing.s4,
              TamamSpacing.s4,
              TamamSpacing.s16,
            ),
            itemCount: items.length,
            itemBuilder: (BuildContext context, int index) {
              final SavedPlace place = items[index];
              return TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
                onTap: () => unawaited(_editPlace(context, ref, place)),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: context.colors.surfaceBrandSoft,
                        borderRadius: BorderRadius.circular(TamamRadius.sm),
                      ),
                      child: Icon(_iconFor(place.kind), color: context.colors.primary),
                    ),
                    const SizedBox(width: TamamSpacing.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            place.label,
                            style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                          ),
                          Text(
                            place.address.formatted,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.bodySm.toTextStyle(color: context.colors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: l10n.actionDelete,
                      icon: Icon(Icons.delete_outline_rounded, color: context.colors.danger),
                      onPressed: () => unawaited(_deletePlace(context, ref, place)),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  static IconData _iconFor(SavedPlaceKind kind) {
    switch (kind) {
      case SavedPlaceKind.home:
        return Icons.home_rounded;
      case SavedPlaceKind.work:
        return Icons.work_rounded;
      case SavedPlaceKind.custom:
        return Icons.place_rounded;
    }
  }

  Future<void> _addPlace(BuildContext context, WidgetRef ref) async {
    final Address? address = await context.push<Address>(Routes.locationPicker);
    if (address == null || !context.mounted) return;
    await _openEditor(context, ref, address: address);
  }

  Future<void> _editPlace(BuildContext context, WidgetRef ref, SavedPlace place) =>
      _openEditor(context, ref, address: place.address, existing: place);

  Future<void> _openEditor(
    BuildContext context,
    WidgetRef ref, {
    required Address address,
    SavedPlace? existing,
  }) async {
    final _PlaceDraft? draft = await SheetScaffold.show<_PlaceDraft>(
      context,
      (BuildContext sheetContext) => _PlaceEditorSheet(address: address, existing: existing),
    );
    if (draft == null || !context.mounted) return;
    try {
      await ref.read(savedPlacesProvider.notifier).save(
            SavedPlace(
              id: existing?.id ?? '',
              kind: draft.kind,
              label: draft.label,
              address: draft.address,
              createdAt: existing?.createdAt ?? DateTime.now(),
            ),
            id: existing?.id,
          );
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }

  Future<void> _deletePlace(BuildContext context, WidgetRef ref, SavedPlace place) async {
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.savedPlacesDeleteTitle,
      message: l10n.savedPlacesDeleteBody(place.label),
      confirmLabel: l10n.actionDelete,
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    try {
      await ref.read(savedPlacesProvider.notifier).remove(place.id);
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }
}

/// What the editor sheet returns.
class _PlaceDraft {
  const _PlaceDraft({required this.kind, required this.label, required this.address});

  final SavedPlaceKind kind;
  final String label;
  final Address address;
}

class _PlaceEditorSheet extends StatefulWidget {
  const _PlaceEditorSheet({required this.address, this.existing});

  final Address address;
  final SavedPlace? existing;

  @override
  State<_PlaceEditorSheet> createState() => _PlaceEditorSheetState();
}

class _PlaceEditorSheetState extends State<_PlaceEditorSheet> {
  late final TextEditingController _label = TextEditingController(text: widget.existing?.label ?? '');
  late final TextEditingController _building =
      TextEditingController(text: widget.existing?.address.building ?? widget.address.building ?? '');
  late final TextEditingController _floor =
      TextEditingController(text: widget.existing?.address.floor ?? widget.address.floor ?? '');
  late final TextEditingController _apartment =
      TextEditingController(text: widget.existing?.address.apartment ?? widget.address.apartment ?? '');
  late final TextEditingController _notes =
      TextEditingController(text: widget.existing?.address.notes ?? widget.address.notes ?? '');
  late SavedPlaceKind _kind = widget.existing?.kind ?? SavedPlaceKind.custom;

  @override
  void dispose() {
    _label.dispose();
    _building.dispose();
    _floor.dispose();
    _apartment.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _submit() {
    final String label = _label.text.trim();
    if (label.isEmpty) return;
    Navigator.of(context).pop(
      _PlaceDraft(
        kind: _kind,
        label: label,
        address: widget.address.copyWith(
          label: label,
          building: _building.text.trim(),
          floor: _floor.text.trim(),
          apartment: _apartment.text.trim(),
          notes: _notes.text.trim(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return SheetScaffold(
      title: widget.existing == null ? l10n.savedPlacesAdd : l10n.savedPlacesEdit,
      subtitle: widget.address.formatted,
      footer: TamamButton(label: l10n.actionSave, onPressed: _submit),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            spacing: TamamSpacing.s2,
            children: SavedPlaceKind.values
                .map(
                  (SavedPlaceKind kind) => ChoiceChip(
                    label: Text(_kindLabel(l10n, kind)),
                    selected: _kind == kind,
                    onSelected: (bool _) => setState(() {
                      _kind = kind;
                      if (_label.text.trim().isEmpty) _label.text = _kindLabel(l10n, kind);
                    }),
                  ),
                )
                .toList(growable: false),
          ),
          const SizedBox(height: TamamSpacing.s4),
          TextField(
            controller: _label,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(labelText: l10n.savedPlacesLabel),
          ),
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: _building,
                  decoration: InputDecoration(labelText: l10n.addressBuilding),
                ),
              ),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: TextField(
                  controller: _floor,
                  decoration: InputDecoration(labelText: l10n.addressFloor),
                ),
              ),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: TextField(
                  controller: _apartment,
                  decoration: InputDecoration(labelText: l10n.addressApartment),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: InputDecoration(labelText: l10n.addressNotes),
          ),
        ],
      ),
    );
  }

  String _kindLabel(AppLocalizations l10n, SavedPlaceKind kind) {
    switch (kind) {
      case SavedPlaceKind.home:
        return l10n.placeKindHome;
      case SavedPlaceKind.work:
        return l10n.placeKindWork;
      case SavedPlaceKind.custom:
        return l10n.placeKindCustom;
    }
  }
}
