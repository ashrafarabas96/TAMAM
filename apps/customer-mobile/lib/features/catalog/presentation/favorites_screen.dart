import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Services the customer marked as favourites.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.favoritesTitle)),
      body: AsyncView<List<ServiceCategory>>(
        value: ref.watch(favoritesProvider),
        onRetry: () => ref.invalidate(favoritesProvider),
        isEmpty: (List<ServiceCategory> items) => items.isEmpty,
        emptyTitle: l10n.favoritesEmptyTitle,
        emptyMessage: l10n.favoritesEmptyBody,
        emptyIcon: Icons.favorite_border_rounded,
        emptyActionLabel: l10n.actionBrowse,
        onEmptyAction: () => context.push(Routes.search),
        builder: (List<ServiceCategory> categories) => ListView.builder(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          itemCount: categories.length,
          itemBuilder: (BuildContext context, int index) {
            final ServiceCategory category = categories[index];
            return TamamCard(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
              onTap: () => context.push(Routes.category(category.id)),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: category.color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(TamamRadius.sm),
                    ),
                    child: Icon(Icons.build_rounded, color: category.color),
                  ),
                  const SizedBox(width: TamamSpacing.s3),
                  Expanded(
                    child: Text(
                      category.name.resolve(language),
                      style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                    ),
                  ),
                  IconButton(
                    tooltip: l10n.actionUnfavorite,
                    icon: Icon(Icons.favorite_rounded, color: context.colors.danger),
                    onPressed: () => unawaited(
                      ref.read(favoritesProvider.notifier).toggle(category.id, isFavorite: true),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
