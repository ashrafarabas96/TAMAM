import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/maps/map_view.dart';
import 'package:tamam_customer/core/maps/polyline_codec.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/checkout_panel.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/fare_option_card.dart';
import 'package:tamam_customer/features/places/presentation/address_sheet.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/features/ride/presentation/ride_flow_controller.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The ride flow: a map with the route, and a sheet that walks from addresses
/// to vehicle choice to checkout.
class RideFlowScreen extends ConsumerStatefulWidget {
  const RideFlowScreen({super.key});

  @override
  ConsumerState<RideFlowScreen> createState() => _RideFlowScreenState();
}

class _RideFlowScreenState extends ConsumerState<RideFlowScreen> {
  final MapController _map = MapController();

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  Future<void> _pickPickup() async {
    final Address? address = await AddressSheet.show(
      context,
      ref,
      title: context.l10n.ridePickupTitle,
      applyToCurrent: false,
    );
    if (address == null) return;
    ref.read(rideFlowProvider.notifier).setPickup(address);
    unawaited(_estimate());
  }

  Future<void> _pickDestination() async {
    final Address? address = await AddressSheet.show(
      context,
      ref,
      title: context.l10n.rideDestinationTitle,
      applyToCurrent: false,
    );
    if (address == null) return;
    ref.read(rideFlowProvider.notifier).setDestination(address);
    unawaited(_estimate());
  }

  Future<void> _estimate() async {
    await ref.read(rideFlowProvider.notifier).estimate();
    if (!mounted) return;
    _fitRoute();
  }

  void _fitRoute() {
    final RideFlowState state = ref.read(rideFlowProvider);
    final List<LatLng> points = <LatLng>[
      if (state.pickup != null) state.pickup!.toLatLng(),
      if (state.destination != null) state.destination!.toLatLng(),
      ...PolylineCodec.decode(state.estimate?.routePolyline),
    ];
    MapView.fitPoints(_map, points, padding: const EdgeInsets.fromLTRB(48, 96, 48, 320));
  }

  Future<void> _submit() async {
    final Job? job = await ref.read(rideFlowProvider.notifier).submit();
    if (!mounted || job == null) return;
    context.pushReplacement(Routes.job(job.id));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final RideFlowState state = ref.watch(rideFlowProvider);
    final List<LatLng> route = PolylineCodec.decode(state.estimate?.routePolyline);
    final LatLng center = state.pickup?.toLatLng() ??
        ref.watch(currentAddressProvider)?.toLatLng() ??
        LocationService.fallbackCenter.toLatLng();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.serviceRide)),
      body: Stack(
        children: <Widget>[
          MapView(
            controller: _map,
            tileUrlTemplate: ref.watch(appEnvProvider).mapTileUrlTemplate,
            attribution: ref.watch(appEnvProvider).mapAttribution,
            center: center,
            route: route,
            padding: const EdgeInsets.only(bottom: 320),
            markers: <MapMarkerSpec>[
              if (state.pickup != null)
                MapMarkerSpec(point: state.pickup!.toLatLng(), kind: MapMarkerKind.pickup),
              if (state.destination != null)
                MapMarkerSpec(point: state.destination!.toLatLng(), kind: MapMarkerKind.destination),
            ],
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: _RideSheet(
              state: state,
              onPickPickup: () => unawaited(_pickPickup()),
              onPickDestination: () => unawaited(_pickDestination()),
              onSwap: () {
                ref.read(rideFlowProvider.notifier).swapEnds();
                unawaited(_estimate());
              },
              onRetryEstimate: () => unawaited(_estimate()),
              onSubmit: () => unawaited(_submit()),
            ),
          ),
        ],
      ),
    );
  }
}

class _RideSheet extends ConsumerWidget {
  const _RideSheet({
    required this.state,
    required this.onPickPickup,
    required this.onPickDestination,
    required this.onSwap,
    required this.onRetryEstimate,
    required this.onSubmit,
  });

  final RideFlowState state;
  final VoidCallback onPickPickup;
  final VoidCallback onPickDestination;
  final VoidCallback onSwap;
  final VoidCallback onRetryEstimate;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.sheet)),
        boxShadow: TamamElevation.sheet,
      ),
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.72),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            TamamSpacing.s5,
            TamamSpacing.s4,
            TamamSpacing.s5,
            TamamSpacing.s5,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _AddressRows(
                state: state,
                onPickPickup: onPickPickup,
                onPickDestination: onPickDestination,
                onSwap: onSwap,
              ),
              const SizedBox(height: TamamSpacing.s4),
              if (state.failure != null) ...<Widget>[
                Container(
                  padding: const EdgeInsets.all(TamamSpacing.s3),
                  decoration: BoxDecoration(
                    color: colors.dangerSoft,
                    borderRadius: BorderRadius.circular(TamamRadius.md),
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          localizedFailure(l10n, state.failure!),
                          style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong),
                        ),
                      ),
                      TextButton(onPressed: onRetryEstimate, child: Text(l10n.actionRetry)),
                    ],
                  ),
                ),
                const SizedBox(height: TamamSpacing.s3),
              ],
              if (state.estimating)
                const SkeletonList(itemCount: 3, itemHeight: 72)
              else if (state.estimate != null) ...<Widget>[
                for (int i = 0; i < state.estimate!.options.length; i++) ...<Widget>[
                  FareOptionCard(
                    option: state.estimate!.options[i],
                    selected: state.selectedOption == i,
                    onTap: () => ref.read(rideFlowProvider.notifier).selectOption(i),
                  ),
                  const SizedBox(height: TamamSpacing.s2),
                ],
                const SizedBox(height: TamamSpacing.s2),
                CheckoutPanel(
                  selection: state.checkout,
                  onPaymentChanged: ref.read(rideFlowProvider.notifier).setPaymentMethod,
                  onApplyPromo: (String code) =>
                      unawaited(ref.read(rideFlowProvider.notifier).applyPromo(code)),
                  onClearPromo: ref.read(rideFlowProvider.notifier).clearPromo,
                  onScheduleChanged: ref.read(rideFlowProvider.notifier).setSchedule,
                ),
                const SizedBox(height: TamamSpacing.s4),
                if (state.option != null)
                  FareBreakdownList(
                    lines: state.option!.breakdown,
                    total: Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            l10n.checkoutTotal,
                            style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                          ),
                        ),
                        MoneyText(state.checkout.hasPromo
                            ? state.checkout.promoPreview!.total
                            : state.option!.total),
                      ],
                    ),
                  ),
                const SizedBox(height: TamamSpacing.s4),
                TamamButton(
                  label: state.checkout.isScheduled ? l10n.rideScheduleCta : l10n.rideOrderCta,
                  busy: state.submitting,
                  onPressed: state.canSubmit ? onSubmit : null,
                ),
              ] else
                TamamButton(
                  label: l10n.rideGetEstimate,
                  onPressed: state.canEstimate ? onRetryEstimate : null,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddressRows extends StatelessWidget {
  const _AddressRows({
    required this.state,
    required this.onPickPickup,
    required this.onPickDestination,
    required this.onSwap,
  });

  final RideFlowState state;
  final VoidCallback onPickPickup;
  final VoidCallback onPickDestination;
  final VoidCallback onSwap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    return Row(
      children: <Widget>[
        Expanded(
          child: Column(
            children: <Widget>[
              _AddressRow(
                icon: Icons.trip_origin_rounded,
                color: colors.mapPickup,
                label: l10n.ridePickupLabel,
                value: state.pickup?.formatted ?? l10n.ridePickupEmpty,
                onTap: onPickPickup,
              ),
              Divider(height: 1, color: colors.border, indent: 34),
              _AddressRow(
                icon: Icons.place_rounded,
                color: colors.mapDestination,
                label: l10n.rideDestinationLabel,
                value: state.destination?.formatted ?? l10n.rideDestinationEmpty,
                onTap: onPickDestination,
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: l10n.rideSwap,
          onPressed: state.canEstimate ? onSwap : null,
          icon: const Icon(Icons.swap_vert_rounded),
        ),
      ],
    );
  }
}

class _AddressRow extends StatelessWidget {
  const _AddressRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: '$label: $value',
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s3),
          child: Row(
            children: <Widget>[
              Icon(icon, size: TamamSize.iconMd, color: color),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                    ),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TamamType.bodyLg.toTextStyle(color: colors.textPrimary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
