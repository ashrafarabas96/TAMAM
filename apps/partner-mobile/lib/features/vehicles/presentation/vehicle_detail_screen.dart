import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_tile.dart';
import 'package:tamam_partner/features/documents/presentation/widgets/document_upload_sheet.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_screen.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// One vehicle: photos, details, its own documents and the activate action.
class VehicleDetailScreen extends ConsumerWidget {
  const VehicleDetailScreen({required this.vehicleId, super.key});

  /// The documents a vehicle carries in its own right.
  static const List<DocumentType> vehicleDocumentTypes = <DocumentType>[
    DocumentType.vehicleLicense,
    DocumentType.insurance,
  ];

  final String vehicleId;

  Future<void> _activate(BuildContext context, WidgetRef ref, Vehicle vehicle) async {
    try {
      await ref.read(vehiclesRepositoryProvider).activate(vehicle.id);
      ref
        ..invalidate(vehiclesProvider)
        ..invalidate(vehicleProvider(vehicle.id))
        ..invalidate(partnerProfileProvider);
      if (context.mounted) {
        AppFeedback.showMessage(context, context.l10n.vehicleActivated(vehicle.title), icon: Icons.check_rounded);
      }
    } on AppFailure catch (failure) {
      if (context.mounted) AppFeedback.showFailure(context, failure);
    }
  }

  Future<void> _uploadDocument(BuildContext context, WidgetRef ref, DocumentType type) async {
    final DocumentUploadResult? result = await DocumentUploadSheet.show(context, type: type);
    if (result == null) return;
    try {
      await ref.read(vehiclesRepositoryProvider).addDocument(
            vehicleId,
            type: result.type,
            mediaId: result.mediaId,
            number: result.number,
            issuedAt: result.issuedAt,
            expiresAt: result.expiresAt,
          );
      ref.invalidate(vehicleDocumentsProvider(vehicleId));
      if (context.mounted) {
        AppFeedback.showMessage(context, context.l10n.documentUploaded, icon: Icons.check_rounded);
      }
    } on AppFailure catch (failure) {
      if (context.mounted) AppFeedback.showFailure(context, failure);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.vehicleDetailTitle)),
      body: AsyncView<Vehicle>(
        value: ref.watch(vehicleProvider(vehicleId)),
        onRetry: () => ref.invalidate(vehicleProvider(vehicleId)),
        builder: (Vehicle vehicle) => ListView(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          children: <Widget>[
            if (vehicle.photoUrls.isNotEmpty)
              SizedBox(
                height: 160,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: vehicle.photoUrls.length,
                  separatorBuilder: (BuildContext _, int __) => const SizedBox(width: TamamSpacing.s2),
                  itemBuilder: (BuildContext _, int index) => ClipRRect(
                    borderRadius: BorderRadius.circular(TamamRadius.md),
                    child: CachedNetworkImage(
                      imageUrl: vehicle.photoUrls[index],
                      width: 220,
                      fit: BoxFit.cover,
                      placeholder: (BuildContext _, String __) => Container(width: 220, color: colors.skeleton),
                      errorWidget: (BuildContext _, String __, Object ___) => Container(
                        width: 220,
                        color: colors.skeleton,
                        child: Icon(Icons.directions_car_rounded, color: colors.textTertiary),
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(vehicle.title, style: TamamType.headingMd.toTextStyle(color: colors.textPrimary)),
                      ),
                      StatusPill(
                        label: VehiclesScreen.statusLabel(l10n, vehicle.verificationStatus),
                        tone: VehiclesScreen.statusTone(vehicle.verificationStatus),
                      ),
                    ],
                  ),
                  const SizedBox(height: TamamSpacing.s2),
                  _Detail(label: l10n.vehiclePlate, value: vehicle.plate),
                  _Detail(label: l10n.vehicleYear, value: '${vehicle.year}'),
                  _Detail(label: l10n.vehicleColor, value: vehicle.color),
                  _Detail(label: l10n.vehicleSeats, value: '${vehicle.seats}'),
                  if (vehicle.vehicleType != null)
                    _Detail(label: l10n.vehicleType, value: vehicle.vehicleType!.name.resolve(language)),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            if (vehicle.isActive)
              TamamCard(
                background: colors.surfaceBrandSoft,
                elevated: false,
                child: Row(
                  children: <Widget>[
                    Icon(Icons.check_circle_rounded, color: colors.primary),
                    const SizedBox(width: TamamSpacing.s2),
                    Expanded(
                      child: Text(l10n.vehicleIsActive, style: TamamType.bodyMd.toTextStyle(color: colors.primary)),
                    ),
                  ],
                ),
              )
            else
              TamamButton(
                label: l10n.vehicleActivate,
                icon: Icons.bolt_rounded,
                onPressed: vehicle.canActivate ? () => unawaited(_activate(context, ref, vehicle)) : null,
              ),
            const SizedBox(height: TamamSpacing.s5),
            Text(l10n.vehicleDocuments, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
            const SizedBox(height: TamamSpacing.s2),
            _VehicleDocuments(
              vehicleId: vehicleId,
              onUpload: (DocumentType type) => unawaited(_uploadDocument(context, ref, type)),
            ),
          ],
        ),
      ),
    );
  }
}

class _VehicleDocuments extends ConsumerWidget {
  const _VehicleDocuments({required this.vehicleId, required this.onUpload});

  final String vehicleId;
  final void Function(DocumentType type) onUpload;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final List<PartnerDocument> documents =
        ref.watch(vehicleDocumentsProvider(vehicleId)).valueOrNull ?? const <PartnerDocument>[];

    PartnerDocument? latestOf(DocumentType type) {
      PartnerDocument? latest;
      for (final PartnerDocument doc in documents) {
        if (doc.type != type) continue;
        if (latest == null || doc.createdAt.isAfter(latest.createdAt)) latest = doc;
      }
      return latest;
    }

    return Column(
      children: <Widget>[
        for (final DocumentType type in VehicleDetailScreen.vehicleDocumentTypes)
          DocumentTile(type: type, document: latestOf(type), onUpload: () => onUpload(type)),
      ],
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(label, style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary)),
            ),
            Text(
              value,
              textDirection: TextDirection.ltr,
              style: TamamType.labelMd.toTextStyle(color: context.colors.textPrimary),
            ),
          ],
        ),
      );
}
