import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/format/money_formatter.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/offline_banner.dart';
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/wallet/data/wallet_repository.dart';
import 'package:tamam_customer/features/wallet/presentation/wallet_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';
import 'package:url_launcher/url_launcher.dart';

/// Balance, statement and top-up.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.walletTitle)),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref
                  ..invalidate(walletProvider)
                  ..invalidate(statementProvider);
              },
              child: ListView(
                padding: const EdgeInsets.all(TamamSpacing.s4),
                children: <Widget>[
                  const _BalanceCard(),
                  const SizedBox(height: TamamSpacing.s4),
                  const _QuickLinks(),
                  const SizedBox(height: TamamSpacing.s5),
                  Text(
                    l10n.walletStatement,
                    style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                  ),
                  const SizedBox(height: TamamSpacing.s3),
                  const _Statement(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends ConsumerWidget {
  const _BalanceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool canTopUp = ref.watch(featureFlagsValueProvider).hasCardPayments;

    return AsyncView<Wallet>(
      value: ref.watch(walletProvider),
      onRetry: () => ref.invalidate(walletProvider),
      loading: const SkeletonBox(height: 148, radius: TamamRadius.card),
      builder: (Wallet wallet) => TamamCard(
        background: colors.surfaceBrand,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.walletBalance,
              style: TamamType.labelMd.toTextStyle(color: TamamBrand.purple100),
            ),
            const SizedBox(height: TamamSpacing.s1),
            MoneyText(wallet.balance, color: colors.textOnBrand),
            if (wallet.hasPending) ...<Widget>[
              const SizedBox(height: TamamSpacing.s1),
              Row(
                children: <Widget>[
                  Text(
                    l10n.walletPending,
                    style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
                  ),
                  const SizedBox(width: TamamSpacing.s1),
                  MoneyText(
                    wallet.pendingBalance,
                    emphasis: MoneyEmphasis.subtle,
                    color: TamamBrand.purple100,
                  ),
                ],
              ),
            ],
            if (canTopUp) ...<Widget>[
              const SizedBox(height: TamamSpacing.s4),
              TamamButton(
                label: l10n.walletTopUp,
                onPressed: () => unawaited(_TopUpSheet.show(context, wallet.currency)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuickLinks extends ConsumerWidget {
  const _QuickLinks();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Row(
      children: <Widget>[
        Expanded(
          child: TamamCard(
            onTap: () => context.push(Routes.promos),
            child: Column(
              children: <Widget>[
                Icon(Icons.local_offer_rounded, color: context.colors.primary),
                const SizedBox(height: TamamSpacing.s1),
                Text(l10n.walletPromos, style: TamamType.labelMd.toTextStyle()),
              ],
            ),
          ),
        ),
        if (ref.watch(featureFlagsValueProvider).hasReferrals) ...<Widget>[
          const SizedBox(width: TamamSpacing.s3),
          Expanded(
            child: TamamCard(
              onTap: () => context.push(Routes.referrals),
              child: Column(
                children: <Widget>[
                  Icon(Icons.card_giftcard_rounded, color: context.colors.primary),
                  const SizedBox(height: TamamSpacing.s1),
                  Text(l10n.walletReferrals, style: TamamType.labelMd.toTextStyle()),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Statement extends ConsumerWidget {
  const _Statement();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return AsyncView<List<LedgerEntry>>(
      value: ref.watch(statementProvider),
      onRetry: () => ref.invalidate(statementProvider),
      loading: const SkeletonList(itemCount: 4, itemHeight: 64),
      isEmpty: (List<LedgerEntry> items) => items.isEmpty,
      emptyTitle: l10n.walletEmptyTitle,
      emptyMessage: l10n.walletEmptyBody,
      emptyIcon: Icons.receipt_long_outlined,
      builder: (List<LedgerEntry> entries) => Column(
        children: <Widget>[
          for (final LedgerEntry entry in entries)
            TamamCard(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
              onTap: entry.jobId == null ? null : () => context.push(Routes.job(entry.jobId!)),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          entry.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TamamType.bodyMd.toTextStyle(color: context.colors.textPrimary),
                        ),
                        Text(
                          units.dateTime(entry.createdAt),
                          style: TamamType.bodySm.toTextStyle(color: context.colors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                  MoneyText(entry.signedAmount, emphasis: MoneyEmphasis.subtle, signed: true),
                ],
              ),
            ),
          if (ref.read(statementProvider.notifier).hasMore)
            TextButton(
              onPressed: () => unawaited(ref.read(statementProvider.notifier).loadMore()),
              child: Text(l10n.actionLoadMore),
            ),
        ],
      ),
    );
  }
}

/// Top-up starts a provider checkout; the balance only changes when the
/// provider's webhook settles server-side.
class _TopUpSheet extends ConsumerStatefulWidget {
  const _TopUpSheet({required this.currency});

  final String currency;

  static Future<void> show(BuildContext context, String currency) =>
      SheetScaffold.show<void>(context, (BuildContext _) => _TopUpSheet(currency: currency));

  @override
  ConsumerState<_TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends ConsumerState<_TopUpSheet> {
  static const List<int> _presetsMajor = <int>[20, 50, 100, 200];

  int _major = 50;
  bool _busy = false;

  /// Converts a whole-unit preset into the minor units the API expects, using
  /// the currency's own exponent (JOD has three, ILS and USD two).
  Money _asMoney(int major) {
    int minor = major;
    for (int i = 0; i < MoneyFormatter.decimalsFor(widget.currency); i++) {
      minor *= 10;
    }
    return Money(amount: minor, currency: widget.currency);
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final TopUpIntent intent = await ref.read(walletRepositoryProvider).topUp(
            amount: _asMoney(_major),
            method: 'CARD',
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      final String? url = intent.redirectUrl;
      if (url != null) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
      ref.invalidate(walletProvider);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return SheetScaffold(
      title: l10n.walletTopUp,
      subtitle: l10n.walletTopUpHint,
      footer: TamamButton(
        label: l10n.actionContinue,
        busy: _busy,
        onPressed: () => unawaited(_submit()),
      ),
      child: Wrap(
        spacing: TamamSpacing.s2,
        runSpacing: TamamSpacing.s2,
        children: _presetsMajor
            .map(
              (int amount) => ChoiceChip(
                label: MoneyText(
                  _asMoney(amount),
                  emphasis: MoneyEmphasis.subtle,
                  compact: true,
                ),
                selected: _major == amount,
                onSelected: (bool _) => setState(() => _major = amount),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}
