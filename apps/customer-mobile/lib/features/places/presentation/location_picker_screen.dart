import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/maps/map_view.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Pin-in-the-centre map picker with live reverse geocoding.
///
/// Returns the chosen [Address] via `Navigator.pop`, so callers can `await` it.
class LocationPickerScreen extends ConsumerStatefulWidget {
  const LocationPickerScreen({super.key, this.initial, this.title});

  final Address? initial;
  final String? title;

  @override
  ConsumerState<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends ConsumerState<LocationPickerScreen> {
  final MapController _controller = MapController();

  Timer? _debounce;
  LatLng? _center;
  Address? _resolved;
  bool _resolving = false;
  bool _moving = false;

  @override
  void initState() {
    super.initState();
    final Address? seed = widget.initial ?? ref.read(currentAddressProvider);
    _center = seed?.toLatLng() ?? LocationService.fallbackCenter.toLatLng();
    _resolved = seed;
    if (seed == null) unawaited(_locateMe());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _locateMe() async {
    final GeoPoint? point = await ref.read(locationServiceProvider).current();
    if (point == null || !mounted) return;
    _controller.move(point.toLatLng(), 16);
    setState(() => _center = point.toLatLng());
    _scheduleResolve();
  }

  void _onMoved(LatLng center, bool byGesture) {
    _center = center;
    if (!byGesture) return;
    if (!_moving) setState(() => _moving = true);
    _scheduleResolve();
  }

  /// Reverse geocoding is debounced: dragging the map fires dozens of updates
  /// and Nominatim's policy is one request per second.
  void _scheduleResolve() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () => unawaited(_resolve()));
  }

  Future<void> _resolve() async {
    final LatLng? center = _center;
    if (center == null || !mounted) return;
    setState(() {
      _resolving = true;
      _moving = false;
    });
    try {
      final Address address = await ref.read(geocodingServiceProvider).reverse(
            GeoPoint.fromLatLng(center),
            language: ref.read(localeControllerProvider).languageCode,
          );
      if (mounted) setState(() => _resolved = address);
    } on Object {
      // Keep the coordinates so the customer can still confirm the pin.
      if (mounted) {
        setState(
          () => _resolved = Address(
            lat: center.latitude,
            lng: center.longitude,
            formatted: '${center.latitude.toStringAsFixed(5)}, ${center.longitude.toStringAsFixed(5)}',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final LatLng center = _center ?? LocationService.fallbackCenter.toLatLng();

    return Scaffold(
      appBar: AppBar(title: Text(widget.title ?? l10n.locationPickerTitle)),
      body: Stack(
        children: <Widget>[
          MapView(
            controller: _controller,
            tileUrlTemplate: ref.watch(appEnvProvider).mapTileUrlTemplate,
            attribution: ref.watch(appEnvProvider).mapAttribution,
            center: center,
            zoom: 16,
            onPositionChanged: _onMoved,
          ),
          // The centre pin sits above the map and never moves; the map moves
          // under it, which is what makes the interaction feel precise.
          IgnorePointer(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 34),
                child: AnimatedScale(
                  scale: _moving ? 1.12 : 1,
                  duration: TamamMotion.durationFast,
                  child: Icon(Icons.place_rounded, size: 46, color: colors.primary),
                ),
              ),
            ),
          ),
          PositionedDirectional(
            bottom: 190,
            end: TamamSpacing.s4,
            child: FloatingActionButton.small(
              heroTag: 'locate-me',
              backgroundColor: colors.surface,
              foregroundColor: colors.primary,
              tooltip: l10n.addressUseCurrent,
              onPressed: () => unawaited(_locateMe()),
              child: const Icon(Icons.my_location_rounded),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.sheet)),
                boxShadow: TamamElevation.sheet,
              ),
              padding: const EdgeInsets.fromLTRB(
                TamamSpacing.s5,
                TamamSpacing.s5,
                TamamSpacing.s5,
                TamamSpacing.s4,
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      l10n.locationPickerHint,
                      style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                    ),
                    const SizedBox(height: TamamSpacing.s1),
                    if (_resolving)
                      const SkeletonBox(height: 22)
                    else
                      Text(
                        _resolved?.formatted ?? l10n.locationPickerMoveMap,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                      ),
                    const SizedBox(height: TamamSpacing.s4),
                    TamamButton(
                      label: l10n.locationPickerConfirm,
                      onPressed: _resolved == null || _resolving
                          ? null
                          : () => Navigator.of(context).pop(_resolved),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
