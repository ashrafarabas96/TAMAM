import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The wallet ledger: every credit and debit with the balance after it.
class StatementScreen extends ConsumerWidget {
  const StatementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.statementTitle)),
      body: AsyncView<CursorPage<LedgerEntry>>(
        value: ref.watch(statementProvider),
        onRetry: () => ref.invalidate(statementProvider),
        isEmpty: (CursorPage<LedgerEntry> page) => page.items.isEmpty,
        emptyTitle: l10n.statementEmptyTitle,
        emptyMessage: l10n.statementEmptyBody,
        emptyIcon: Icons.receipt_long_outlined,
        builder: (CursorPage<LedgerEntry> page) => RefreshIndicator(
          color: colors.primary,
          onRefresh: () async => ref.invalidate(statementProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            itemCount: page.items.length + (page.hasMore ? 1 : 0),
            itemBuilder: (BuildContext context, int index) {
              if (index >= page.items.length) {
                return Center(
                  child: TextButton(
                    onPressed: () => unawaited(ref.read(statementProvider.notifier).loadMore()),
                    child: Text(l10n.actionLoadMore),
                  ),
                );
              }
              final LedgerEntry entry = page.items[index];
              return TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                onTap: entry.jobId == null ? null : () => context.push(Routes.job(entry.jobId!)),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: entry.isCredit ? colors.successSoft : colors.dangerSoft,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        entry.isCredit ? Icons.south_west_rounded : Icons.north_east_rounded,
                        size: TamamSize.iconSm,
                        color: entry.isCredit ? colors.success : colors.danger,
                      ),
                    ),
                    const SizedBox(width: TamamSpacing.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            entry.description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary),
                          ),
                          Text(
                            units.dateTime(entry.createdAt),
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: <Widget>[
                        MoneyText(entry.signedAmount, emphasis: MoneyEmphasis.subtle, signed: true),
                        Text(
                          l10n.statementBalanceAfter(ref.watch(moneyFormatterProvider).formatCompact(entry.balanceAfter)),
                          style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
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
