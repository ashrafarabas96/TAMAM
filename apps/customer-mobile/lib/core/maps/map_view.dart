import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';

/// The roles a marker can play; each one has a fixed look from the tokens.
enum MapMarkerKind { pickup, destination, partner, focus }

/// A marker request expressed in domain terms — the widget decides how it looks.
class MapMarkerSpec {
  const MapMarkerSpec({
    required this.point,
    required this.kind,
    this.headingDegrees,
    this.label,
  });

  final LatLng point;
  final MapMarkerKind kind;

  /// Rotates the partner icon so the vehicle points where it is driving.
  final double? headingDegrees;
  final String? label;
}

/// The app's only map surface.
///
/// Everything tile-provider specific lives here: swapping OpenStreetMap for
/// MapLibre or a commercial provider is a change to [tileUrlTemplate] and
/// nothing else.
class MapView extends StatelessWidget {
  const MapView({
    required this.tileUrlTemplate,
    required this.attribution,
    required this.center,
    super.key,
    this.controller,
    this.zoom = 14,
    this.markers = const <MapMarkerSpec>[],
    this.route = const <LatLng>[],
    this.interactive = true,
    this.onPositionChanged,
    this.onMapReady,
    this.padding = const EdgeInsets.only(bottom: 0),
  });

  final String tileUrlTemplate;
  final String attribution;
  final LatLng center;
  final MapController? controller;
  final double zoom;
  final List<MapMarkerSpec> markers;
  final List<LatLng> route;
  final bool interactive;

  /// Fired continuously while the user drags — used by the location picker to
  /// keep the centre pin's address in sync.
  final void Function(LatLng center, bool byGesture)? onPositionChanged;
  final VoidCallback? onMapReady;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Stack(
      children: <Widget>[
        FlutterMap(
          mapController: controller,
          options: MapOptions(
            initialCenter: center,
            initialZoom: zoom,
            backgroundColor: colors.surfaceAlt,
            interactionOptions: InteractionOptions(
              flags: interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none,
            ),
            onMapReady: onMapReady,
            onPositionChanged: onPositionChanged == null
                ? null
                : (MapCamera camera, bool hasGesture) => onPositionChanged!(camera.center, hasGesture),
          ),
          children: <Widget>[
            TileLayer(
              urlTemplate: tileUrlTemplate,
              userAgentPackageName: 'app.tamam.customer',
              maxNativeZoom: 19,
            ),
            if (route.length > 1)
              PolylineLayer(
                polylines: <Polyline<Object>>[
                  Polyline<Object>(points: route, strokeWidth: 5, color: colors.mapRoute),
                ],
              ),
            if (markers.isNotEmpty)
              MarkerLayer(
                markers: markers
                    .map(
                      (MapMarkerSpec spec) => Marker(
                        point: spec.point,
                        width: 44,
                        height: 52,
                        alignment: spec.kind == MapMarkerKind.partner ? Alignment.center : Alignment.topCenter,
                        child: _MapMarkerIcon(spec: spec, colors: colors),
                      ),
                    )
                    .toList(growable: false),
              ),
          ],
        ),
        Positioned(
          left: TamamSpacing.s2,
          right: TamamSpacing.s2,
          bottom: padding.bottom + TamamSpacing.s1,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.surface.withOpacity(0.78),
                borderRadius: BorderRadius.circular(TamamRadius.xs),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: 2),
                child: Text(
                  attribution,
                  style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Frames a set of points with sane padding — used after an estimate returns
  /// pickup, destination and the route between them.
  static void fitPoints(MapController controller, List<LatLng> points, {EdgeInsets padding = const EdgeInsets.all(56)}) {
    if (points.isEmpty) return;
    if (points.length == 1) {
      controller.move(points.first, 15);
      return;
    }
    controller.fitCamera(
      CameraFit.bounds(bounds: LatLngBounds.fromPoints(points), padding: padding),
    );
  }
}

class _MapMarkerIcon extends StatelessWidget {
  const _MapMarkerIcon({required this.spec, required this.colors});

  final MapMarkerSpec spec;
  final TamamColors colors;

  @override
  Widget build(BuildContext context) {
    switch (spec.kind) {
      case MapMarkerKind.partner:
        return Transform.rotate(
          angle: (spec.headingDegrees ?? 0) * math.pi / 180,
          child: _Pin(color: colors.primary, icon: Icons.navigation_rounded, circular: true),
        );
      case MapMarkerKind.pickup:
        return _Pin(color: colors.mapPickup, icon: Icons.trip_origin_rounded, circular: false);
      case MapMarkerKind.destination:
        return _Pin(color: colors.mapDestination, icon: Icons.place_rounded, circular: false);
      case MapMarkerKind.focus:
        return _Pin(color: colors.primary, icon: Icons.place_rounded, circular: false);
    }
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.color, required this.icon, required this.circular});

  final Color color;
  final IconData icon;
  final bool circular;

  @override
  Widget build(BuildContext context) {
    final Widget badge = Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: TamamNeutral.n0, width: 2.5),
        boxShadow: TamamElevation.raised,
      ),
      child: Icon(icon, size: 18, color: TamamNeutral.n0),
    );
    if (circular) return Center(child: badge);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        badge,
        Container(width: 3, height: 12, color: color),
      ],
    );
  }
}
