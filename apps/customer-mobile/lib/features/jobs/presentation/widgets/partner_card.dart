import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/avatar.dart';
import 'package:tamam_customer/core/widgets/rating_stars.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/l10n/l10n.dart';
import 'package:url_launcher/url_launcher.dart';

/// The assigned partner: photo, name, rating, vehicle and the call/chat actions.
class PartnerCard extends StatelessWidget {
  const PartnerCard({
    required this.partner,
    super.key,
    this.onChat,
    this.chatEnabled = true,
  });

  final JobPartnerCard partner;
  final VoidCallback? onChat;
  final bool chatEnabled;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final PartnerVehicle? vehicle = partner.vehicle;
    final String language = Localizations.localeOf(context).languageCode;

    return Row(
      children: <Widget>[
        TamamAvatar(
          initials: partner.fullName.isEmpty ? '#' : partner.fullName.substring(0, 1),
          imageUrl: partner.profileImageUrl,
          size: TamamSize.avatarLg,
        ),
        const SizedBox(width: TamamSpacing.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                partner.fullName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
              ),
              RatingBadge(rating: partner.rating, count: partner.ratingCount),
              if (vehicle != null)
                Text(
                  '${vehicle.typeName.resolve(language)} · ${vehicle.title} · ${vehicle.color}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                ),
              if (vehicle != null && vehicle.plate.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: 2),
                  decoration: BoxDecoration(
                    color: colors.surfaceAlt,
                    borderRadius: BorderRadius.circular(TamamRadius.xs),
                    border: Border.all(color: colors.border),
                  ),
                  child: Text(
                    vehicle.plate,
                    textDirection: TextDirection.ltr,
                    style: TamamType.labelMd.toTextStyle(color: colors.textPrimary),
                  ),
                ),
            ],
          ),
        ),
        if (partner.canCall)
          _RoundAction(
            icon: Icons.call_rounded,
            label: l10n.trackingCallPartner,
            onTap: () => unawaited(_call(partner.maskedPhone!)),
          ),
        if (onChat != null && chatEnabled) ...<Widget>[
          const SizedBox(width: TamamSpacing.s2),
          _RoundAction(
            icon: Icons.chat_bubble_outline_rounded,
            label: l10n.trackingChatPartner,
            onTap: onChat!,
          ),
        ],
      ],
    );
  }

  /// Dials the masked number the API returned — the app never sees the real one
  /// when phone masking is enabled.
  Future<void> _call(String phone) async {
    final Uri uri = Uri(scheme: 'tel', path: phone);
    await launchUrl(uri);
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: colors.surfaceBrandSoft,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: TamamSize.touchTargetMin,
            height: TamamSize.touchTargetMin,
            child: Icon(icon, color: colors.primary, size: TamamSize.iconMd),
          ),
        ),
      ),
    );
  }
}
