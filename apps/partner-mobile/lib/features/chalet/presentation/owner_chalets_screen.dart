import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';
import 'package:tamam_partner/features/chalet/presentation/owner_chalet_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The chalets this owner manages.
///
/// A chalet awaiting approval is shown rather than hidden — "where is my
/// chalet?" is the question an owner asks the day after submitting one, and an
/// empty list would be the wrong answer.
class OwnerChaletsScreen extends ConsumerWidget {
  const OwnerChaletsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<OwnerChalet>> chalets = ref.watch(ownerChaletsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.chaletOwnerTitle)),
      body: AsyncView<List<OwnerChalet>>(
        value: chalets,
        onRetry: () => ref.invalidate(ownerChaletsProvider),
        isEmpty: (List<OwnerChalet> items) => items.isEmpty,
        emptyTitle: l10n.chaletOwnerEmpty,
        emptyMessage: l10n.chaletOwnerEmptyBody,
        emptyIcon: Icons.holiday_village_outlined,
        builder: (List<OwnerChalet> items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(ownerChaletsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: TamamSpacing.s3),
            itemBuilder: (BuildContext context, int index) =>
                _OwnerChaletCard(chalet: items[index]),
          ),
        ),
      ),
    );
  }
}

class _OwnerChaletCard extends StatelessWidget {
  const _OwnerChaletCard({required this.chalet});

  final OwnerChalet chalet;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final TextTheme text = Theme.of(context).textTheme;
    final bool isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return TamamCard(
      // A rejected chalet cannot be managed until it is fixed, so opening the
      // dashboard for it would only show an empty calendar.
      onTap: chalet.wasRejected ? null : () => context.push(Routes.ownerChalet(chalet.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  isArabic ? chalet.nameAr : chalet.nameEn,
                  style: text.titleMedium?.copyWith(color: colors.textPrimary),
                ),
              ),
              StatusPill(
                label: _statusLabel(l10n, chalet),
                tone: chalet.isLive
                    ? PillTone.success
                    : chalet.wasRejected
                        ? PillTone.danger
                        : PillTone.warning,
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s1),
          Text(chalet.city, style: text.bodySmall?.copyWith(color: colors.textSecondary)),
          if (chalet.rejectionReason != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Text(
              chalet.rejectionReason!,
              style: text.bodySmall?.copyWith(color: colors.danger),
            ),
          ],
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Icon(Icons.group_outlined, size: 16, color: colors.textTertiary),
              const SizedBox(width: TamamSpacing.s1),
              Text(
                '${chalet.maximumGuests}',
                style: text.bodySmall?.copyWith(color: colors.textSecondary),
              ),
              const Spacer(),
              MoneyText(chalet.baseHourlyRate),
            ],
          ),
        ],
      ),
    );
  }

  static String _statusLabel(AppLocalizations l10n, OwnerChalet chalet) {
    if (chalet.wasRejected) return l10n.chaletOwnerRejected;
    if (chalet.awaitingApproval) return l10n.chaletOwnerPending;
    if (chalet.isLive) return l10n.chaletOwnerLive;
    return l10n.chaletOwnerPaused;
  }
}
