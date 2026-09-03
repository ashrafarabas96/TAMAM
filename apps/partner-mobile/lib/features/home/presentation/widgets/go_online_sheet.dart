import 'dart:async';

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/maps/location_service.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The pre-flight before ONLINE: which roles to work as, which vehicle, and
/// an honest explanation of what "online" means for the phone (continuous
/// location, a persistent notification on Android, the blue bar on iOS).
///
/// Resolves `true` when the partner ended up ONLINE.
class GoOnlineSheet extends ConsumerStatefulWidget {
  const GoOnlineSheet({super.key});

  static Future<bool> show(BuildContext context) async =>
      await SheetScaffold.show<bool>(context, (BuildContext _) => const GoOnlineSheet()) ?? false;

  @override
  ConsumerState<GoOnlineSheet> createState() => _GoOnlineSheetState();
}

class _GoOnlineSheetState extends ConsumerState<GoOnlineSheet> {
  Set<PartnerRoleType> _roles = <PartnerRoleType>{};
  String? _vehicleId;
  bool _seeded = false;
  LocationAvailability? _permission;

  bool get _needsVehicle => _roles.contains(PartnerRoleType.driver) || _roles.contains(PartnerRoleType.courier);

  void _seed(PartnerProfile profile, List<Vehicle> vehicles) {
    if (_seeded) return;
    _seeded = true;
    final AvailabilityController controller = ref.read(availabilityControllerProvider.notifier);
    _roles = controller.preferredRoles(profile.roles).toSet();
    final AvailabilityState state = ref.read(availabilityControllerProvider);
    _vehicleId = state.activeVehicleId ??
        profile.activeVehicleId ??
        vehicles.where((Vehicle v) => v.isActive && v.isApproved).map((Vehicle v) => v.id).firstOrNull ??
        vehicles.where((Vehicle v) => v.isApproved).map((Vehicle v) => v.id).firstOrNull;
  }

  Future<void> _checkPermission() async {
    final LocationAvailability result = await ref.read(availabilityControllerProvider.notifier).ensureLocationPermission();
    if (mounted) setState(() => _permission = result);
  }

  Future<void> _goOnline() async {
    final bool ok = await ref.read(availabilityControllerProvider.notifier).goOnline(
          roles: _roles.toList(growable: false),
          vehicleId: _needsVehicle ? _vehicleId : null,
        );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<PartnerProfile> profile = ref.watch(partnerProfileProvider);
    final AsyncValue<List<Vehicle>> vehicles = ref.watch(vehiclesProvider);
    final AvailabilityState state = ref.watch(availabilityControllerProvider);

    return SheetScaffold(
      title: l10n.goOnlineTitle,
      subtitle: l10n.goOnlineSubtitle,
      footer: profile.hasValue
          ? TamamButton(
              label: l10n.goOnlineConfirm,
              icon: Icons.bolt_rounded,
              busy: state.busy,
              onPressed: _roles.isEmpty || (_needsVehicle && _vehicleId == null) ? null : () => unawaited(_goOnline()),
            )
          : null,
      child: profile.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(TamamSpacing.s8),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (Object error, StackTrace _) => Padding(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          child: Text(localizedFailure(l10n, asFailure(error)), style: TamamType.bodyMd.toTextStyle(color: colors.danger)),
        ),
        data: (PartnerProfile data) {
          final List<Vehicle> fleet = vehicles.valueOrNull ?? const <Vehicle>[];
          _seed(data, fleet);
          final List<Vehicle> approved = fleet.where((Vehicle v) => v.isApproved).toList(growable: false);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _Explainer(permission: _permission, onCheck: () => unawaited(_checkPermission())),
              const SizedBox(height: TamamSpacing.s4),
              Text(l10n.goOnlineRoles, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
              const SizedBox(height: TamamSpacing.s2),
              Wrap(
                spacing: TamamSpacing.s2,
                runSpacing: TamamSpacing.s2,
                children: <Widget>[
                  for (final PartnerRoleType role in data.roles)
                    FilterChip(
                      avatar: Icon(JobLabels.roleIcon(role), size: TamamSize.iconSm),
                      label: Text(JobLabels.role(l10n, role)),
                      selected: _roles.contains(role),
                      onSelected: (bool selected) => setState(() {
                        if (selected) {
                          _roles = <PartnerRoleType>{..._roles, role};
                        } else {
                          _roles = _roles.where((PartnerRoleType r) => r != role).toSet();
                        }
                      }),
                    ),
                ],
              ),
              if (_needsVehicle) ...<Widget>[
                const SizedBox(height: TamamSpacing.s4),
                Text(l10n.goOnlineVehicle, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
                const SizedBox(height: TamamSpacing.s2),
                if (vehicles.isLoading)
                  const LinearProgressIndicator()
                else if (approved.isEmpty)
                  _Notice(
                    tone: colors.warningSoft,
                    foreground: TamamSemantic.warningStrong,
                    icon: Icons.directions_car_outlined,
                    text: l10n.goOnlineNoVehicle,
                    actionLabel: l10n.vehiclesAdd,
                    onAction: () {
                      Navigator.of(context).pop(false);
                      context.push(Routes.vehicleNew);
                    },
                  )
                else
                  for (final Vehicle vehicle in approved)
                    RadioListTile<String>(
                      value: vehicle.id,
                      groupValue: _vehicleId,
                      contentPadding: EdgeInsets.zero,
                      title: Text(vehicle.title),
                      subtitle: Text(vehicle.plate, textDirection: TextDirection.ltr),
                      onChanged: (String? value) => setState(() => _vehicleId = value),
                    ),
              ],
              if (state.failure != null || state.blocker != null) ...<Widget>[
                const SizedBox(height: TamamSpacing.s4),
                _BlockerNotice(state: state),
              ],
              const SizedBox(height: TamamSpacing.s2),
            ],
          );
        },
      ),
    );
  }
}

class _Explainer extends StatelessWidget {
  const _Explainer({required this.permission, required this.onCheck});

  final LocationAvailability? permission;
  final VoidCallback onCheck;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool always = permission == LocationAvailability.grantedAlways;
    final bool usable = permission?.isUsable ?? false;
    return Container(
      padding: const EdgeInsets.all(TamamSpacing.s3),
      decoration: BoxDecoration(color: colors.surfaceBrandSoft, borderRadius: BorderRadius.circular(TamamRadius.md)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.my_location_rounded, color: colors.primary),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(child: Text(l10n.goOnlineLocationTitle, style: TamamType.labelLg.toTextStyle(color: colors.primary))),
            ],
          ),
          const SizedBox(height: TamamSpacing.s2),
          Text(l10n.goOnlineLocationBody, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
          const SizedBox(height: TamamSpacing.s2),
          Text(l10n.goOnlineForegroundBody, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
          const SizedBox(height: TamamSpacing.s2),
          Row(
            children: <Widget>[
              Icon(
                always
                    ? Icons.check_circle_rounded
                    : usable
                        ? Icons.warning_amber_rounded
                        : Icons.radio_button_unchecked_rounded,
                size: TamamSize.iconSm,
                color: always
                    ? colors.success
                    : usable
                        ? colors.warning
                        : colors.textTertiary,
              ),
              const SizedBox(width: TamamSpacing.s1),
              Expanded(
                child: Text(
                  always
                      ? l10n.goOnlinePermissionAlways
                      : usable
                          ? l10n.goOnlinePermissionWhileInUse
                          : l10n.goOnlinePermissionPending,
                  style: TamamType.bodySm.toTextStyle(color: colors.textPrimary),
                ),
              ),
              TextButton(onPressed: onCheck, child: Text(always ? l10n.actionCheck : l10n.actionAllow)),
            ],
          ),
        ],
      ),
    );
  }
}

class _BlockerNotice extends ConsumerWidget {
  const _BlockerNotice({required this.state});

  final AvailabilityState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AvailabilityController controller = ref.read(availabilityControllerProvider.notifier);
    String text;
    String? actionLabel;
    VoidCallback? action;
    switch (state.blocker) {
      case AvailabilityBlocker.notApproved:
        text = state.failure == null ? l10n.errorPartnerNotApproved : localizedFailure(l10n, state.failure!);
      case AvailabilityBlocker.expiredDocuments:
        final String names = state.expiredDocumentTypes.map((String c) => JobLabels.documentTypeCode(l10n, c)).join('، ');
        text = l10n.availabilityExpiredDocuments(names);
        actionLabel = l10n.documentsTitle;
        action = () {
          Navigator.of(context).pop(false);
          context.push(Routes.documents);
        };
      case AvailabilityBlocker.noVehicle:
        text = l10n.goOnlineNoVehicle;
        actionLabel = l10n.vehiclesTitle;
        action = () {
          Navigator.of(context).pop(false);
          context.push(Routes.vehicles);
        };
      case AvailabilityBlocker.locationPermission:
        text = l10n.availabilityPermissionDenied;
        actionLabel = l10n.actionOpenSettings;
        action = () => unawaited(controller.openLocationSettings());
      case AvailabilityBlocker.locationServiceDisabled:
        text = l10n.availabilityServiceDisabled;
        actionLabel = l10n.actionOpenSettings;
        action = () => unawaited(controller.openDeviceLocationSettings());
      case AvailabilityBlocker.activeJob:
        text = l10n.availabilityActiveJobBlocksOffline;
      case null:
        text = state.failure == null ? l10n.errorGeneric : localizedFailure(l10n, state.failure!);
    }
    return _Notice(
      tone: colors.dangerSoft,
      foreground: TamamSemantic.dangerStrong,
      icon: Icons.error_outline_rounded,
      text: text,
      actionLabel: actionLabel,
      onAction: action,
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({
    required this.tone,
    required this.foreground,
    required this.icon,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final Color tone;
  final Color foreground;
  final IconData icon;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(TamamSpacing.s3),
        decoration: BoxDecoration(color: tone, borderRadius: BorderRadius.circular(TamamRadius.md)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(icon, color: foreground, size: TamamSize.iconMd),
                const SizedBox(width: TamamSpacing.s2),
                Expanded(child: Text(text, style: TamamType.bodySm.toTextStyle(color: foreground))),
              ],
            ),
            if (actionLabel != null && onAction != null)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(onPressed: onAction, child: Text(actionLabel!)),
              ),
          ],
        ),
      );
}
