import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Payout requests and where each one stands.
class WithdrawalsScreen extends ConsumerWidget {
  const WithdrawalsScreen({super.key});

  static String statusLabel(AppLocalizations l10n, WithdrawalStatus status) {
    switch (status) {
      case WithdrawalStatus.requested:
        return l10n.withdrawalStatusRequested;
      case WithdrawalStatus.approved:
        return l10n.withdrawalStatusApproved;
      case WithdrawalStatus.paid:
        return l10n.withdrawalStatusPaid;
      case WithdrawalStatus.rejected:
        return l10n.withdrawalStatusRejected;
    }
  }

  static PillTone statusTone(WithdrawalStatus status) {
    switch (status) {
      case WithdrawalStatus.paid:
        return PillTone.success;
      case WithdrawalStatus.rejected:
        return PillTone.danger;
      case WithdrawalStatus.requested:
        return PillTone.warning;
      case WithdrawalStatus.approved:
        return PillTone.info;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.withdrawalsTitle)),
      body: AsyncView<CursorPage<Withdrawal>>(
        value: ref.watch(withdrawalsProvider),
        onRetry: () => ref.invalidate(withdrawalsProvider),
        isEmpty: (CursorPage<Withdrawal> page) => page.items.isEmpty,
        emptyTitle: l10n.withdrawalsEmptyTitle,
        emptyMessage: l10n.withdrawalsEmptyBody,
        emptyIcon: Icons.account_balance_outlined,
        builder: (CursorPage<Withdrawal> page) => RefreshIndicator(
          color: colors.primary,
          onRefresh: () async => ref.invalidate(withdrawalsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            itemCount: page.items.length + (page.hasMore ? 1 : 0),
            itemBuilder: (BuildContext context, int index) {
              if (index >= page.items.length) {
                return Center(
                  child: TextButton(
                    onPressed: () => unawaited(ref.read(withdrawalsProvider.notifier).loadMore()),
                    child: Text(l10n.actionLoadMore),
                  ),
                );
              }
              final Withdrawal withdrawal = page.items[index];
              return TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(child: MoneyText(withdrawal.amount, emphasis: MoneyEmphasis.medium)),
                        StatusPill(
                          label: statusLabel(l10n, withdrawal.status),
                          tone: statusTone(withdrawal.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: TamamSpacing.s1),
                    Text(
                      '${withdrawal.bankName} · ${withdrawal.ibanLast4}',
                      textDirection: TextDirection.ltr,
                      style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                    ),
                    Text(
                      units.dateTime(withdrawal.paidAt ?? withdrawal.createdAt),
                      style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                    ),
                    if (!withdrawal.fee.isZero)
                      Text(
                        l10n.withdrawalFee(ref.watch(moneyFormatterProvider).format(withdrawal.fee)),
                        style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                      ),
                    if (withdrawal.decisionReason != null && withdrawal.decisionReason!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: TamamSpacing.s1),
                        child: Text(
                          withdrawal.decisionReason!,
                          style: TamamType.bodySm.toTextStyle(
                            color: withdrawal.status == WithdrawalStatus.rejected ? colors.danger : colors.textSecondary,
                          ),
                        ),
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
