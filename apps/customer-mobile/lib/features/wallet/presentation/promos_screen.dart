import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/wallet/data/wallet_repository.dart';
import 'package:tamam_customer/features/wallet/presentation/wallet_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// "العروض" — enter a promo code now and have it applied at the next checkout.
class PromosScreen extends ConsumerStatefulWidget {
  const PromosScreen({super.key});

  @override
  ConsumerState<PromosScreen> createState() => _PromosScreenState();
}

class _PromosScreenState extends ConsumerState<PromosScreen> {
  final TextEditingController _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  /// Codes cannot be validated without an estimate to price them against, so
  /// the code is stored and applied automatically at the next checkout.
  Future<void> _save() async {
    final String code = _code.text.trim().toUpperCase();
    if (code.isEmpty) return;
    await ref.read(pendingPromoProvider.notifier).set(code);
    if (!mounted) return;
    AppFeedback.showMessage(context, context.l10n.promoSaved(code), icon: Icons.local_offer_rounded);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String? pending = ref.watch(pendingPromoProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.promosTitle)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          TamamCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  l10n.promoEnterTitle,
                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                ),
                const SizedBox(height: TamamSpacing.s1),
                Text(
                  l10n.promoEnterBody,
                  style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                ),
                const SizedBox(height: TamamSpacing.s3),
                TextField(
                  controller: _code,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    labelText: l10n.checkoutPromoLabel,
                    hintText: l10n.checkoutPromoHint,
                  ),
                ),
                const SizedBox(height: TamamSpacing.s3),
                TamamButton(label: l10n.actionSave, onPressed: () => unawaited(_save())),
              ],
            ),
          ),
          if (pending != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              background: colors.successSoft,
              child: Row(
                children: <Widget>[
                  Icon(Icons.check_circle_rounded, color: colors.success),
                  const SizedBox(width: TamamSpacing.s2),
                  Expanded(
                    child: Text(
                      l10n.promoPending(pending),
                      style: TamamType.labelMd.toTextStyle(color: TamamSemantic.successStrong),
                    ),
                  ),
                  IconButton(
                    tooltip: l10n.actionRemove,
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => unawaited(ref.read(pendingPromoProvider.notifier).clear()),
                  ),
                ],
              ),
            ),
          ],
          if (ref.watch(featureFlagsValueProvider).hasReferrals) ...<Widget>[
            const SizedBox(height: TamamSpacing.s5),
            const ReferralCard(),
          ],
        ],
      ),
    );
  }
}

/// The referral programme: the customer's code, what the invitee gets, and a
/// share sheet with the server-provided message.
class ReferralCard extends ConsumerWidget {
  const ReferralCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = ref.watch(localeControllerProvider).languageCode;

    return AsyncView<ReferralInfo>(
      value: ref.watch(referralProvider),
      onRetry: () => ref.invalidate(referralProvider),
      builder: (ReferralInfo referral) => TamamCard(
        background: colors.surfaceBrand,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              l10n.referralsTitle,
              style: TamamType.headingMd.toTextStyle(color: colors.textOnBrand),
            ),
            const SizedBox(height: TamamSpacing.s1),
            if (referral.inviteeReward != null)
              Row(
                children: <Widget>[
                  Text(
                    l10n.referralsRewardPrefix,
                    style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
                  ),
                  const SizedBox(width: TamamSpacing.s1),
                  MoneyText(
                    referral.inviteeReward!,
                    emphasis: MoneyEmphasis.subtle,
                    color: colors.accent,
                  ),
                ],
              ),
            const SizedBox(height: TamamSpacing.s4),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: TamamSpacing.s4,
                vertical: TamamSpacing.s3,
              ),
              decoration: BoxDecoration(
                color: TamamNeutral.n0.withOpacity(0.12),
                borderRadius: BorderRadius.circular(TamamRadius.md),
                border: Border.all(color: TamamBrand.purple300),
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      referral.code,
                      textDirection: TextDirection.ltr,
                      style: TamamType.headingMd
                          .toTextStyle(color: colors.accent)
                          .copyWith(letterSpacing: 3),
                    ),
                  ),
                  IconButton(
                    tooltip: l10n.actionCopy,
                    icon: Icon(Icons.copy_rounded, color: colors.textOnBrand),
                    onPressed: () => unawaited(_copy(context, referral.code)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            Text(
              l10n.referralsStats(referral.invitedCount, referral.rewardedCount),
              style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
            ),
            const SizedBox(height: TamamSpacing.s4),
            TamamButton(
              label: l10n.referralsShare,
              icon: Icons.ios_share_rounded,
              onPressed: () => unawaited(Share.share(referral.shareText.resolve(language))),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _copy(BuildContext context, String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (context.mounted) {
      AppFeedback.showMessage(context, context.l10n.referralsCopied, icon: Icons.check_rounded);
    }
  }
}

/// Standalone referrals screen reachable from the wallet and deep links.
class ReferralsScreen extends StatelessWidget {
  const ReferralsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: context.colors.background,
        appBar: AppBar(title: Text(context.l10n.referralsTitle)),
        body: const Padding(
          padding: EdgeInsets.all(TamamSpacing.s4),
          child: ReferralCard(),
        ),
      );
}
