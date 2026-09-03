import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/directional_chevron.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/features/earnings/presentation/widgets/withdraw_sheet.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// "أرباحي" — today / week / month, the full breakdown, and the payout entry
/// points. Every number is the server's; the app only formats.
class EarningsScreen extends ConsumerStatefulWidget {
  const EarningsScreen({super.key});

  @override
  ConsumerState<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends ConsumerState<EarningsScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: EarningsPeriod.values.length, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  String _periodLabel(AppLocalizations l10n, EarningsPeriod period) {
    switch (period) {
      case EarningsPeriod.today:
        return l10n.earningsToday;
      case EarningsPeriod.week:
        return l10n.earningsWeek;
      case EarningsPeriod.month:
        return l10n.earningsMonth;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.earningsTitle),
        bottom: TabBar(
          controller: _tabs,
          tabs: <Widget>[
            for (final EarningsPeriod period in EarningsPeriod.values) Tab(text: _periodLabel(l10n, period)),
          ],
        ),
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: <Widget>[
                for (final EarningsPeriod period in EarningsPeriod.values) _PeriodTab(period: period),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PeriodTab extends ConsumerWidget {
  const _PeriodTab({required this.period});

  final EarningsPeriod period;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return AsyncView<PartnerEarnings>(
      value: ref.watch(earningsProvider(period)),
      onRetry: () => ref.invalidate(earningsProvider(period)),
      builder: (PartnerEarnings earnings) => RefreshIndicator(
        color: colors.primary,
        onRefresh: () async {
          ref
            ..invalidate(earningsProvider(period))
            ..invalidate(walletProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          children: <Widget>[
            TamamCard(
              background: colors.surfaceBrand,
              child: Column(
                children: <Widget>[
                  Text(l10n.earningsNet, style: TamamType.labelMd.toTextStyle(color: TamamBrand.purple200)),
                  const SizedBox(height: TamamSpacing.s1),
                  MoneyText(
                    earnings.netEarnings,
                    color: colors.accent,
                    style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: TamamSpacing.s2),
                  Text(
                    l10n.earningsCompletedJobs(units.number(earnings.completedJobs)),
                    style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
                  ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  _Row(label: l10n.earningsGross, money: earnings.grossEarnings),
                  _Row(
                    label: l10n.earningsCommission,
                    money: Money(amount: -earnings.commission.amount.abs(), currency: earnings.currency),
                    signed: true,
                  ),
                  if (!earnings.bonuses.isZero) _Row(label: l10n.earningsBonuses, money: earnings.bonuses, signed: true),
                  if (!earnings.adjustments.isZero)
                    _Row(label: l10n.earningsAdjustments, money: earnings.adjustments, signed: true),
                  Divider(color: colors.border),
                  _Row(label: l10n.earningsNet, money: earnings.netEarnings, emphasis: MoneyEmphasis.medium),
                  if (!earnings.withdrawals.isZero)
                    _Row(
                      label: l10n.earningsWithdrawals,
                      money: Money(amount: -earnings.withdrawals.amount.abs(), currency: earnings.currency),
                      signed: true,
                    ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(l10n.earningsBalance, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
                      ),
                      MoneyText(earnings.currentBalance),
                    ],
                  ),
                  const SizedBox(height: TamamSpacing.s3),
                  TamamButton(
                    label: l10n.withdrawTitle,
                    icon: Icons.account_balance_rounded,
                    onPressed: earnings.currentBalance.amount <= 0
                        ? null
                        : () => unawaited(_withdraw(context, ref, earnings.currentBalance)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s3),
            TamamCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: <Widget>[
                  ListTile(
                    leading: Icon(Icons.receipt_long_rounded, color: colors.primary),
                    title: Text(l10n.statementTitle),
                    trailing: const DirectionalChevron(),
                    onTap: () => context.push(Routes.statement),
                  ),
                  Divider(height: 1, color: colors.border, indent: 56),
                  ListTile(
                    leading: Icon(Icons.payments_rounded, color: colors.primary),
                    title: Text(l10n.withdrawalsTitle),
                    trailing: const DirectionalChevron(),
                    onTap: () => context.push(Routes.withdrawals),
                  ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s8),
          ],
        ),
      ),
    );
  }

  Future<void> _withdraw(BuildContext context, WidgetRef ref, Money balance) async {
    final bool ok = await WithdrawSheet.show(context, balance: balance);
    if (ok && context.mounted) {
      ref.invalidate(earningsProvider(period));
      AppFeedback.showMessage(context, context.l10n.withdrawRequested, icon: Icons.check_rounded);
    }
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.money,
    this.signed = false,
    this.emphasis = MoneyEmphasis.subtle,
  });

  final String label;
  final Money money;
  final bool signed;
  final MoneyEmphasis emphasis;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(label, style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary))),
            MoneyText(money, emphasis: emphasis, signed: signed),
          ],
        ),
      );
}
