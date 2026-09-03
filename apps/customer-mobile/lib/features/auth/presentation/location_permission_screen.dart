import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Explains *why* the app wants the location before the OS dialog appears —
/// asking cold is the main reason people deny it permanently.
class LocationPermissionScreen extends ConsumerStatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  ConsumerState<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends ConsumerState<LocationPermissionScreen> {
  bool _busy = false;
  LocationAvailability? _result;

  Future<void> _request() async {
    setState(() => _busy = true);
    final LocationAvailability availability = await ref.read(locationServiceProvider).request();
    if (availability == LocationAvailability.granted) {
      await ref.read(currentAddressProvider.notifier).useDeviceLocation();
    }
    await ref.read(prefsStoreProvider).setBool(PrefsStore.keyLocationPromptShown, value: true);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _result = availability;
    });
    if (availability == LocationAvailability.granted) _continue();
  }

  Future<void> _skip() async {
    await ref.read(prefsStoreProvider).setBool(PrefsStore.keyLocationPromptShown, value: true);
    if (!mounted) return;
    _continue();
  }

  void _continue() => context.go(Routes.home);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool blocked = _result == LocationAvailability.deniedForever;
    final bool serviceOff = _result == LocationAvailability.serviceDisabled;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(TamamSpacing.s6),
          child: Column(
            children: <Widget>[
              const Spacer(),
              Container(
                width: 132,
                height: 132,
                decoration: BoxDecoration(color: colors.surfaceBrandSoft, shape: BoxShape.circle),
                child: Icon(Icons.my_location_rounded, size: 62, color: colors.primary),
              ),
              const SizedBox(height: TamamSpacing.s7),
              Text(
                l10n.locationPermissionTitle,
                textAlign: TextAlign.center,
                style: TamamType.headingLg.toTextStyle(color: colors.textPrimary),
              ),
              const SizedBox(height: TamamSpacing.s3),
              Text(
                l10n.locationPermissionBody,
                textAlign: TextAlign.center,
                style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
              ),
              const SizedBox(height: TamamSpacing.s5),
              _Reason(icon: Icons.pin_drop_rounded, text: l10n.locationReasonPickup),
              _Reason(icon: Icons.timer_outlined, text: l10n.locationReasonEta),
              _Reason(icon: Icons.map_outlined, text: l10n.locationReasonZone),
              const Spacer(),
              if (blocked || serviceOff)
                Padding(
                  padding: const EdgeInsets.only(bottom: TamamSpacing.s3),
                  child: Text(
                    blocked ? l10n.locationBlockedHint : l10n.locationServiceOffHint,
                    textAlign: TextAlign.center,
                    style: TamamType.bodySm.toTextStyle(color: colors.warning),
                  ),
                ),
              TamamButton(
                label: blocked || serviceOff ? l10n.actionOpenSettings : l10n.locationAllow,
                busy: _busy,
                onPressed: () {
                  if (blocked) {
                    unawaited(ref.read(locationServiceProvider).openAppSettings());
                  } else if (serviceOff) {
                    unawaited(ref.read(locationServiceProvider).openLocationSettings());
                  } else {
                    unawaited(_request());
                  }
                },
              ),
              const SizedBox(height: TamamSpacing.s2),
              TamamButton(
                label: l10n.locationChooseManually,
                variant: TamamButtonVariant.ghost,
                onPressed: () => unawaited(_skip()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Reason extends StatelessWidget {
  const _Reason({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s2),
      child: Row(
        children: <Widget>[
          Icon(icon, size: TamamSize.iconMd, color: colors.primary),
          const SizedBox(width: TamamSpacing.s3),
          Expanded(
            child: Text(
              text,
              style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
