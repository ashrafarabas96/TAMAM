import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/section_header.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/placement_banner.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Category detail: description, subcategories, priced options and the CTA that
/// starts the ordering flow.
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({required this.categoryId, super.key});

  final String categoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;

    return Scaffold(
      backgroundColor: context.colors.background,
      body: AsyncView<ServiceCategory>(
        value: ref.watch(categoryProvider(categoryId)),
        onRetry: () => ref.invalidate(categoryProvider(categoryId)),
        builder: (ServiceCategory category) => _CategoryBody(category: category, language: language),
      ),
      bottomNavigationBar: ref.watch(categoryProvider(categoryId)).maybeWhen(
            data: (ServiceCategory category) => SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(TamamSpacing.s4),
                child: TamamButton(
                  label: l10n.categoryOrderNow,
                  onPressed: () => context.push(Routes.service(category.id)),
                ),
              ),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
    );
  }
}

class _CategoryBody extends ConsumerWidget {
  const _CategoryBody({required this.category, required this.language});

  final ServiceCategory category;
  final String language;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<ServiceCategory> favorites =
        ref.watch(favoritesProvider).valueOrNull ?? const <ServiceCategory>[];
    final bool isFavorite = favorites.any((ServiceCategory c) => c.id == category.id);

    return CustomScrollView(
      slivers: <Widget>[
        SliverAppBar(
          pinned: true,
          expandedHeight: 168,
          backgroundColor: colors.surfaceBrand,
          actions: <Widget>[
            IconButton(
              tooltip: isFavorite ? l10n.actionUnfavorite : l10n.actionFavorite,
              icon: Icon(isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded),
              onPressed: () => unawaited(
                ref.read(favoritesProvider.notifier).toggle(category.id, isFavorite: isFavorite),
              ),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              category.name.resolve(language),
              style: TamamType.headingMd.toTextStyle(color: colors.textOnBrand),
            ),
            background: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[category.color, colors.surfaceBrand],
                ),
              ),
              child: Align(
                alignment: AlignmentDirectional.bottomEnd,
                child: Padding(
                  padding: const EdgeInsets.all(TamamSpacing.s5),
                  child: Icon(
                    Icons.handyman_rounded,
                    size: 78,
                    color: colors.textOnBrand.withOpacity(0.18),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: TamamSpacing.s4)),
        const SliverToBoxAdapter(
          child: PlacementBanner(placement: BannerPlacement.serviceCategoryTop),
        ),
        if (category.description != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                TamamSpacing.s4,
                TamamSpacing.s5,
                TamamSpacing.s4,
                0,
              ),
              child: Text(
                category.description!.resolve(language),
                style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
              ),
            ),
          ),
        SliverToBoxAdapter(child: _PriceSummary(category: category)),
        if (category.subcategories.isNotEmpty) ...<Widget>[
          SliverToBoxAdapter(child: SectionHeader(title: l10n.categorySubcategories)),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
            sliver: SliverList.builder(
              itemCount: category.subcategories.length,
              itemBuilder: (BuildContext context, int index) {
                final ServiceSubcategory sub = category.subcategories[index];
                return TamamCard(
                  margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                  onTap: () => context.push(Routes.service(category.id)),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              sub.name.resolve(language),
                              style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                            ),
                            if (sub.description != null)
                              Text(
                                sub.description!.resolve(language),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                              ),
                            if (sub.estimatedDurationMin != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  l10n.categoryDuration(sub.estimatedDurationMin!),
                                  style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (sub.fixedPrice != null)
                        MoneyText(sub.fixedPrice!, emphasis: MoneyEmphasis.subtle)
                      else if (sub.startingFrom != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: <Widget>[
                            Text(
                              l10n.pricingStartingFrom,
                              style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                            ),
                            MoneyText(sub.startingFrom!, emphasis: MoneyEmphasis.subtle),
                          ],
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: TamamSpacing.s10)),
      ],
    );
  }
}

/// Explains how this category is priced before the customer commits.
class _PriceSummary extends StatelessWidget {
  const _PriceSummary({required this.category});

  final ServiceCategory category;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<Widget> rows = <Widget>[];

    if (category.fixedPrice != null) {
      rows.add(_row(context, l10n.pricingFixed, category.fixedPrice!));
    }
    if (category.startingFrom != null) {
      rows.add(_row(context, l10n.pricingStartingFrom, category.startingFrom!));
    }
    if (category.hourlyRate != null) {
      rows.add(_row(context, l10n.pricingHourly, category.hourlyRate!));
    }
    if (category.inspectionFee != null) {
      rows.add(_row(context, l10n.pricingInspectionFee, category.inspectionFee!));
    }
    if (rows.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s5, TamamSpacing.s4, 0),
      child: TamamCard(
        background: colors.surfaceBrandSoft,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            ...rows,
            if (category.needsInspection) ...<Widget>[
              const SizedBox(height: TamamSpacing.s2),
              Text(
                l10n.pricingInspectionExplainer,
                style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, Money amount) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                label,
                style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
              ),
            ),
            MoneyText(amount, emphasis: MoneyEmphasis.subtle),
          ],
        ),
      );
}
