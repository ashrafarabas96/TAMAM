import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The partner's fleet: which vehicle is active, which is still under review.
class VehiclesScreen extends ConsumerWidget {
  const VehiclesScreen({super.key});

  static String statusLabel(AppLocalizations l10n, VerificationStatus status) {
    switch (status) {
      case VerificationStatus.approved:
        return l10n.vehicleStatusApproved;
      case VerificationStatus.rejected:
        return l10n.vehicleStatusRejected;
      case VerificationStatus.suspended:
        return l10n.vehicleStatusSuspended;
      case VerificationStatus.draft:
      case VerificationStatus.pending:
      case VerificationStatus.underReview:
        return l10n.vehicleStatusPending;
    }
  }

  static PillTone statusTone(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.approved:
        return PillTone.success;
      case VerificationStatus.rejected:
      case VerificationStatus.suspended:
        return PillTone.danger;
      case VerificationStatus.draft:
      case VerificationStatus.pending:
      case VerificationStatus.underReview:
        return PillTone.warning;
    }
  }

  Future<void> _activate(BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    try {
      await ref.read(vehiclesRepositoryProvider).activate(vehicle.id);
      ref
        ..invalidate(vehiclesProvider)
        ..invalidate(partnerProfileProvider);
      if (context.mounted) {
        AppFeedback.showMessage(context, context.l10n.vehicleActivated(vehicle.title), icon: Icons.check_rounded);
      }
    } on AppFailure catch (failure) {
      if (context.mounted) AppFeedback.showFailure(context, failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.vehiclesTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(Routes.vehicleNew),
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.vehiclesAdd),
      ),
      body: AsyncView<List<Vehicle>>(
        value: ref.watch(vehiclesProvider),
        onRetry: () => ref.invalidate(vehiclesProvider),
        isEmpty: (List<Vehicle> items) => items.isEmpty,
        emptyTitle: l10n.vehiclesEmptyTitle,
        emptyMessage: l10n.vehiclesEmptyBody,
        emptyIcon: Icons.directions_car_outlined,
        emptyActionLabel: l10n.vehiclesAdd,
        onEmptyAction: () => context.push(Routes.vehicleNew),
        builder: (List<Vehicle> vehicles) => RefreshIndicator(
          color: colors.primary,
          onRefresh: () async => ref.invalidate(vehiclesProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s4, TamamSpacing.s4, TamamSpacing.s16),
            itemCount: vehicles.length,
            itemBuilder: (BuildContext context, int index) {
              final Vehicle vehicle = vehicles[index];
              return TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                onTap: () => context.push(Routes.vehicle(vehicle.id)),
                border: vehicle.isActive ? Border.all(color: colors.primary, width: 1.6) : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Icon(Icons.directions_car_rounded, color: colors.primary),
                        const SizedBox(width: TamamSpacing.s3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(vehicle.title, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
                              Text(
                                '${vehicle.plate} · ${vehicle.color} · ${vehicle.year}',
                                textDirection: TextDirection.ltr,
                                style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        StatusPill(
                          label: statusLabel(l10n, vehicle.verificationStatus),
                          tone: statusTone(vehicle.verificationStatus),
                          dense: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: TamamSpacing.s2),
                    Row(
                      children: <Widget>[
                        if (vehicle.isActive)
                          StatusPill(label: l10n.vehicleActive, tone: PillTone.brand, icon: Icons.check_rounded)
                        else if (vehicle.canActivate)
                          TextButton.icon(
                            onPressed: () => unawaited(_activate(context, ref, vehicle)),
                            icon: const Icon(Icons.bolt_rounded, size: TamamSize.iconSm),
                            label: Text(l10n.vehicleActivate),
                          )
                        else
                          Text(
                            l10n.vehicleNotActivatable,
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                      ],
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
}
