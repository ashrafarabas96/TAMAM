import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/maps/geocoding_service.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/features/places/domain/saved_place.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The one place the app asks "which address?".
///
/// Offers, in order: the device location, saved places, free-text search and a
/// map picker — so a customer without GPS permission is never stuck.
class AddressSheet extends ConsumerStatefulWidget {
  const AddressSheet({super.key, this.title, this.applyToCurrent = true});

  final String? title;

  /// When `true` the pick also becomes the app-wide current address.
  final bool applyToCurrent;

  /// Opens the sheet and returns the chosen address, if any.
  static Future<Address?> show(
    BuildContext context,
    WidgetRef ref, {
    String? title,
    bool applyToCurrent = true,
  }) =>
      SheetScaffold.show<Address>(
        context,
        (BuildContext _) => AddressSheet(title: title, applyToCurrent: applyToCurrent),
      );

  @override
  ConsumerState<AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends ConsumerState<AddressSheet> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';
  bool _locating = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _pick(Address address) async {
    if (widget.applyToCurrent) {
      await ref.read(currentAddressProvider.notifier).select(address);
    }
    if (!mounted) return;
    Navigator.of(context).pop(address);
  }

  Future<void> _useDeviceLocation() async {
    setState(() => _locating = true);
    final bool ok = await ref.read(currentAddressProvider.notifier).useDeviceLocation();
    if (!mounted) return;
    setState(() => _locating = false);
    if (!ok) {
      AppFeedback.showMessage(context, context.l10n.locationUnavailable, icon: Icons.location_off_rounded);
      return;
    }
    final Address? address = ref.read(currentAddressProvider);
    if (address != null && mounted) Navigator.of(context).pop(address);
  }

  Future<void> _openMapPicker() async {
    final Address? picked = await context.push<Address>(Routes.locationPicker);
    if (picked != null && mounted) await _pick(picked);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<List<SavedPlace>> saved = ref.watch(savedPlacesProvider);
    final AsyncValue<List<PlaceSuggestion>> suggestions = ref.watch(placeSearchProvider(_query));

    return SheetScaffold(
      title: widget.title ?? l10n.addressSheetTitle,
      scrollable: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          TextField(
            controller: _controller,
            autofocus: false,
            textInputAction: TextInputAction.search,
            onChanged: (String value) => setState(() => _query = value),
            decoration: InputDecoration(
              hintText: l10n.addressSearchHint,
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded),
                      tooltip: l10n.actionClear,
                      onPressed: () {
                        _controller.clear();
                        setState(() => _query = '');
                      },
                    ),
            ),
          ),
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Expanded(
                child: _QuickAction(
                  icon: Icons.my_location_rounded,
                  label: l10n.addressUseCurrent,
                  busy: _locating,
                  onTap: () => unawaited(_useDeviceLocation()),
                ),
              ),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: _QuickAction(
                  icon: Icons.map_outlined,
                  label: l10n.addressPickOnMap,
                  onTap: () => unawaited(_openMapPicker()),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s4),
          Flexible(
            child: _query.trim().length >= 2
                ? _SuggestionList(
                    suggestions: suggestions,
                    onPick: (PlaceSuggestion suggestion) => unawaited(_pick(suggestion.toAddress())),
                  )
                : _SavedList(
                    saved: saved,
                    onPick: (SavedPlace place) => unawaited(_pick(place.address)),
                    onManage: () {
                      Navigator.of(context).pop();
                      context.push(Routes.savedPlaces);
                    },
                  ),
          ),
          const SizedBox(height: TamamSpacing.s2),
          Text(
            l10n.addressAttribution,
            textAlign: TextAlign.center,
            style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.busy = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(TamamRadius.md),
        child: Container(
          height: TamamSize.buttonHeightLg,
          padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3),
          decoration: BoxDecoration(
            color: colors.surfaceBrandSoft,
            borderRadius: BorderRadius.circular(TamamRadius.md),
          ),
          child: Row(
            children: <Widget>[
              if (busy)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary),
                )
              else
                Icon(icon, size: TamamSize.iconMd, color: colors.primary),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TamamType.labelMd.toTextStyle(color: colors.primary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SavedList extends StatelessWidget {
  const _SavedList({required this.saved, required this.onPick, required this.onManage});

  final AsyncValue<List<SavedPlace>> saved;
  final ValueChanged<SavedPlace> onPick;
  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return saved.when(
      skipLoadingOnRefresh: true,
      loading: () => const SkeletonList(itemCount: 3, itemHeight: 56),
      error: (Object _, StackTrace __) => ListTile(
        leading: const Icon(Icons.add_location_alt_outlined),
        title: Text(l10n.addressManagePlaces),
        onTap: onManage,
      ),
      data: (List<SavedPlace> places) => ListView(
        shrinkWrap: true,
        children: <Widget>[
          for (final SavedPlace place in places)
            ListTile(
              leading: Icon(_iconFor(place.kind), color: context.colors.primary),
              title: Text(place.label),
              subtitle: Text(
                place.address.formatted,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => onPick(place),
            ),
          ListTile(
            leading: const Icon(Icons.tune_rounded),
            title: Text(l10n.addressManagePlaces),
            onTap: onManage,
          ),
        ],
      ),
    );
  }

  IconData _iconFor(SavedPlaceKind kind) {
    switch (kind) {
      case SavedPlaceKind.home:
        return Icons.home_rounded;
      case SavedPlaceKind.work:
        return Icons.work_rounded;
      case SavedPlaceKind.custom:
        return Icons.place_rounded;
    }
  }
}

class _SuggestionList extends StatelessWidget {
  const _SuggestionList({required this.suggestions, required this.onPick});

  final AsyncValue<List<PlaceSuggestion>> suggestions;
  final ValueChanged<PlaceSuggestion> onPick;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return suggestions.when(
      skipLoadingOnRefresh: true,
      loading: () => const SkeletonList(itemCount: 4, itemHeight: 52),
      error: (Object _, StackTrace __) => Padding(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        child: Text(
          l10n.addressSearchFailed,
          style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
        ),
      ),
      data: (List<PlaceSuggestion> items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            child: Text(
              l10n.addressNoResults,
              style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
            ),
          );
        }
        return ListView.builder(
          shrinkWrap: true,
          itemCount: items.length,
          itemBuilder: (BuildContext context, int index) {
            final PlaceSuggestion suggestion = items[index];
            return ListTile(
              leading: Icon(Icons.place_outlined, color: context.colors.textSecondary),
              title: Text(suggestion.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: suggestion.subtitle.isEmpty
                  ? null
                  : Text(suggestion.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
              onTap: () => onPick(suggestion),
            );
          },
        );
      },
    );
  }
}
