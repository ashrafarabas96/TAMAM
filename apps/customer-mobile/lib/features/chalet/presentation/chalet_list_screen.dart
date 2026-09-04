import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/presentation/chalet_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Browse chalets. Filtering by party size is offered up front because it is
/// the filter that most often makes a chalet unbookable, and finding that out
/// on the last screen wastes the whole journey.
class ChaletListScreen extends ConsumerWidget {
  const ChaletListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final ChaletSearchFilters filters = ref.watch(chaletFiltersProvider);
    final AsyncValue<List<ChaletSummary>> results = ref.watch(chaletSearchProvider(filters));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.chaletTitle)),
      body: Column(
        children: <Widget>[
          _GuestFilter(
            selected: filters.guestCount,
            onSelect: (int? guests) => ref.read(chaletFiltersProvider.notifier).setGuests(guests),
          ),
          Expanded(
            child: AsyncView<List<ChaletSummary>>(
              value: results,
              onRetry: () => ref.invalidate(chaletSearchProvider(filters)),
              isEmpty: (List<ChaletSummary> items) => items.isEmpty,
              emptyTitle: l10n.chaletNoResults,
              emptyMessage: l10n.chaletNoResultsBody,
              emptyIcon: Icons.holiday_village_outlined,
              builder: (List<ChaletSummary> items) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(chaletSearchProvider(filters)),
                child: ListView.separated(
                  padding: const EdgeInsets.all(TamamSpacing.s4),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: TamamSpacing.s3),
                  itemBuilder: (BuildContext context, int index) =>
                      ChaletCard(chalet: items[index]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GuestFilter extends StatelessWidget {
  const _GuestFilter({required this.selected, required this.onSelect});

  final int? selected;
  final ValueChanged<int?> onSelect;

  static const List<int> _options = <int>[2, 4, 6, 10, 20];

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
        itemCount: _options.length,
        separatorBuilder: (_, __) => const SizedBox(width: TamamSpacing.s2),
        itemBuilder: (BuildContext context, int index) {
          final int guests = _options[index];
          final bool active = selected == guests;
          return Center(
            child: ChoiceChip(
              label: Text(context.l10n.chaletGuests(guests)),
              selected: active,
              // Tapping the active chip clears the filter rather than doing
              // nothing, so a customer is never stuck inside a narrow search.
              onSelected: (_) => onSelect(active ? null : guests),
              selectedColor: colors.primary,
              labelStyle: TextStyle(color: active ? colors.textOnBrand : colors.textPrimary),
            ),
          );
        },
      ),
    );
  }
}

/// One chalet in the list.
class ChaletCard extends ConsumerWidget {
  const ChaletCard({required this.chalet, super.key});

  final ChaletSummary chalet;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final TamamColors colors = context.colors;
    final AppLocalizations l10n = context.l10n;
    final TextTheme text = Theme.of(context).textTheme;
    final bool isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final String name = isArabic ? chalet.nameAr : chalet.nameEn;

    return TamamCard(
      padding: EdgeInsets.zero,
      semanticLabel: name,
      onTap: () => context.push('${Routes.chalets}/${chalet.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (chalet.coverUrl != null)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.card)),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.network(
                  chalet.coverUrl!,
                  fit: BoxFit.cover,
                  // A missing photo must not break the row; the rest of the
                  // card is what the customer is choosing from anyway.
                  errorBuilder: (_, __, ___) => ColoredBox(color: colors.surfaceAlt),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        name,
                        style: text.titleMedium?.copyWith(color: colors.textPrimary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (chalet.ratingCount > 0) ...<Widget>[
                      Icon(Icons.star_rounded, size: 16, color: colors.accent),
                      const SizedBox(width: 2),
                      Text(chalet.rating.toStringAsFixed(1), style: text.labelMedium),
                    ],
                  ],
                ),
                const SizedBox(height: TamamSpacing.s1),
                Text(
                  chalet.city,
                  style: text.bodySmall?.copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: TamamSpacing.s3),
                Row(
                  children: <Widget>[
                    Icon(Icons.group_outlined, size: 16, color: colors.textTertiary),
                    const SizedBox(width: TamamSpacing.s1),
                    Text(
                      l10n.chaletUpToGuests(chalet.maximumGuests),
                      style: text.bodySmall?.copyWith(color: colors.textSecondary),
                    ),
                    const Spacer(),
                    if (chalet.isDiscounted) ...<Widget>[
                      MoneyText(
                        chalet.baseHourlyRate,
                        emphasis: MoneyEmphasis.subtle,
                        style: text.bodySmall?.copyWith(
                          decoration: TextDecoration.lineThrough,
                          color: colors.textTertiary,
                        ),
                      ),
                      const SizedBox(width: TamamSpacing.s2),
                    ],
                    MoneyText(chalet.effectiveHourlyRate),
                    Text(
                      l10n.chaletPerHour,
                      style: text.bodySmall?.copyWith(color: colors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
