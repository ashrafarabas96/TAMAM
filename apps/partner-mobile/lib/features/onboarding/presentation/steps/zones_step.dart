import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:tamam_partner/core/env/app_env.dart';
import 'package:tamam_partner/core/maps/location_service.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 6: where the partner is willing to work.
///
/// The selection is drawn on the map as it changes, because a list of zone
/// names means nothing to someone who thinks in neighbourhoods.
class ZonesStep extends ConsumerStatefulWidget {
  const ZonesStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<ZonesStep> createState() => _ZonesStepState();
}

class _ZonesStepState extends ConsumerState<ZonesStep> {
  final MapController _map = MapController();
  late Set<String> _selected = widget.state.profile?.zoneIds.toSet() ?? <String>{};

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  void _fit(List<ServiceZone> zones) {
    final List<LatLng> points = <LatLng>[
      for (final ServiceZone zone in zones)
        if (_selected.contains(zone.id)) ...zone.polygon.isEmpty ? <LatLng>[zone.center.toLatLng()] : zone.polygon,
    ];
    if (points.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (points.length == 1) {
        _map.move(points.first, 12);
      } else {
        _map.fitCamera(CameraFit.bounds(bounds: LatLngBounds.fromPoints(points), padding: const EdgeInsets.all(32)));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AppEnv env = ref.watch(appEnvProvider);
    final String language = Localizations.localeOf(context).languageCode;

    return AsyncView<List<ServiceZone>>(
      value: ref.watch(serviceZonesProvider),
      onRetry: () => ref.invalidate(serviceZonesProvider),
      isEmpty: (List<ServiceZone> items) => items.isEmpty,
      emptyTitle: l10n.onboardingNoZones,
      emptyIcon: Icons.map_outlined,
      builder: (List<ServiceZone> zones) {
        final List<ServiceZone> chosen = zones.where((ServiceZone z) => _selected.contains(z.id)).toList(growable: false);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(l10n.onboardingZonesHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
            const SizedBox(height: TamamSpacing.s3),
            ClipRRect(
              borderRadius: BorderRadius.circular(TamamRadius.card),
              child: SizedBox(
                height: 200,
                child: FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: (chosen.isEmpty ? LocationService.fallbackCenter : chosen.first.center).toLatLng(),
                    initialZoom: 10,
                    backgroundColor: colors.surfaceAlt,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                    ),
                  ),
                  children: <Widget>[
                    TileLayer(
                      urlTemplate: env.mapTileUrlTemplate,
                      userAgentPackageName: 'app.tamam.partner',
                      maxNativeZoom: 19,
                    ),
                    PolygonLayer<Object>(
                      polygons: <Polygon<Object>>[
                        for (final ServiceZone zone in zones)
                          if (zone.polygon.length > 2)
                            Polygon<Object>(
                              points: zone.polygon,
                              color: _selected.contains(zone.id)
                                  ? colors.primary.withOpacity(0.24)
                                  : colors.borderStrong.withOpacity(0.08),
                              borderColor: _selected.contains(zone.id) ? colors.primary : colors.border,
                              borderStrokeWidth: _selected.contains(zone.id) ? 2 : 1,
                            ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            for (final ServiceZone zone in zones)
              CheckboxListTile(
                value: _selected.contains(zone.id),
                contentPadding: EdgeInsets.zero,
                title: Text(zone.name.resolve(language)),
                subtitle: Text(zone.city),
                onChanged: (bool? value) {
                  setState(() {
                    _selected = value ?? false
                        ? <String>{..._selected, zone.id}
                        : _selected.where((String id) => id != zone.id).toSet();
                  });
                  _fit(zones);
                },
              ),
            if (widget.state.failure != null) ...<Widget>[
              const SizedBox(height: TamamSpacing.s2),
              Text(
                localizedFailure(l10n, widget.state.failure!),
                style: TamamType.bodySm.toTextStyle(color: colors.danger),
              ),
            ],
            const SizedBox(height: TamamSpacing.s5),
            TamamButton(
              label: l10n.actionNext,
              busy: widget.state.busy,
              onPressed: _selected.isEmpty
                  ? null
                  : () => unawaited(ref.read(onboardingProvider.notifier).saveZones(_selected.toList(growable: false))),
            ),
          ],
        );
      },
    );
  }
}
