import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/maps/map_view.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/status_stepper.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// What someone sees when they open a shared trip link.
///
/// It works signed-out and shows only what the token grants: status, stops, the
/// partner's first name and the ETA.
final FutureProviderFamily<Job, String> publicTrackProvider = FutureProvider.family<Job, String>(
  (Ref ref, String token) => ref.watch(jobsRepositoryProvider).publicTrack(token),
);

class PublicTrackScreen extends ConsumerWidget {
  const PublicTrackScreen({required this.token, super.key});

  final String token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.publicTrackTitle)),
      body: AsyncView<Job>(
        value: ref.watch(publicTrackProvider(token)),
        onRetry: () => ref.invalidate(publicTrackProvider(token)),
        builder: (Job job) => Column(
          children: <Widget>[
            Expanded(
              child: MapView(
                tileUrlTemplate: ref.watch(appEnvProvider).mapTileUrlTemplate,
                attribution: ref.watch(appEnvProvider).mapAttribution,
                center: job.partner?.location?.toLatLng() ??
                    job.pickup?.address.toLatLng() ??
                    LocationService.fallbackCenter.toLatLng(),
                interactive: false,
                markers: <MapMarkerSpec>[
                  if (job.pickup != null)
                    MapMarkerSpec(point: job.pickup!.address.toLatLng(), kind: MapMarkerKind.pickup),
                  if (job.destination != null)
                    MapMarkerSpec(
                      point: job.destination!.address.toLatLng(),
                      kind: MapMarkerKind.destination,
                    ),
                  if (job.partner?.location != null)
                    MapMarkerSpec(
                      point: job.partner!.location!.toLatLng(),
                      kind: MapMarkerKind.partner,
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(TamamSpacing.s4),
              child: TamamCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    JobStatusStepper(type: job.type, status: job.status),
                    if (job.partner != null) ...<Widget>[
                      const SizedBox(height: TamamSpacing.s3),
                      Text(
                        l10n.publicTrackPartner(job.partner!.fullName),
                        style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
                      ),
                    ],
                    const SizedBox(height: TamamSpacing.s2),
                    Text(
                      '${JobLabels.jobType(l10n, job.type)} · ${job.number}',
                      style: TamamType.bodySm.toTextStyle(color: context.colors.textTertiary),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
