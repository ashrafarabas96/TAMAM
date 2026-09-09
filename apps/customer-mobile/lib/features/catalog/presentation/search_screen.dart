import 'package:flutter/material.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_icon_tile.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Instant catalogue search plus a browsable list of every category.
///
/// With an empty query the screen is a directory; once two characters are typed
/// it switches to `GET /catalog/search` results.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool searching = _query.trim().length >= 2;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.searchTitle),
        bottom: PreferredSize(
          preferredSize:
              const Size.fromHeight(TamamSize.inputHeight + TamamSpacing.s4),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              TamamSpacing.s4,
              0,
              TamamSpacing.s4,
              TamamSpacing.s3,
            ),
            child: TextField(
              controller: _controller,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onChanged: (String value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: l10n.homeSearchHint,
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        tooltip: l10n.actionClear,
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                      ),
              ),
            ),
          ),
        ),
      ),
      body: searching ? _Results(query: _query) : const _Directory(),
    );
  }
}

class _Results extends ConsumerWidget {
  const _Results({required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;

    return AsyncView<List<CatalogSearchHit>>(
      value: ref.watch(catalogSearchProvider(query)),
      onRetry: () => ref.invalidate(catalogSearchProvider(query)),
      loading: const Padding(
        padding: EdgeInsets.all(TamamSpacing.s4),
        child: SkeletonList(itemCount: 5, itemHeight: 64),
      ),
      isEmpty: (List<CatalogSearchHit> hits) => hits.isEmpty,
      emptyTitle: l10n.searchNoResultsTitle,
      emptyMessage: l10n.searchNoResultsBody(query),
      emptyIcon: Icons.search_off_rounded,
      builder: (List<CatalogSearchHit> hits) => ListView.builder(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        itemCount: hits.length,
        itemBuilder: (BuildContext context, int index) {
          final CatalogSearchHit hit = hits[index];
          return TamamCard(
            margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
            onTap: () => context.push(Routes.category(hit.categoryId)),
            child: Row(
              children: <Widget>[
                serviceFor(hit.jobType) != null
                    ? TamamIconTile(service: serviceFor(hit.jobType)!, size: 40)
                    : TamamIconTile.glyph(
                        icon: Icons.handyman_rounded,
                        tint: serviceColorFor(hit.jobType),
                        size: 40),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        hit.name.resolve(language),
                        style: TamamType.headingSm
                            .toTextStyle(color: context.colors.textPrimary),
                      ),
                      Text(
                        hit.categoryName.resolve(language),
                        style: TamamType.bodySm
                            .toTextStyle(color: context.colors.textTertiary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Directory extends ConsumerWidget {
  const _Directory();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;

    return AsyncView<List<ServiceCategory>>(
      value: ref.watch(categoriesProvider(JobType.homeService)),
      onRetry: () => ref.invalidate(categoriesProvider(JobType.homeService)),
      loading: const Padding(
        padding: EdgeInsets.all(TamamSpacing.s4),
        child: SkeletonList(itemCount: 6, itemHeight: 72),
      ),
      isEmpty: (List<ServiceCategory> all) => all.isEmpty,
      emptyTitle: l10n.searchDirectoryEmptyTitle,
      emptyMessage: l10n.searchDirectoryEmptyBody,
      emptyIcon: Icons.handyman_outlined,
      builder: (List<ServiceCategory> all) {
        final List<ServiceCategory> categories = all;
        return ListView.builder(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          itemCount: categories.length,
          itemBuilder: (BuildContext context, int index) {
            final ServiceCategory category = categories[index];
            return TamamCard(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
              onTap: () => context.push(Routes.category(category.id)),
              child: Row(
                children: <Widget>[
                  TamamIconTile.glyph(
                      icon: Icons.build_rounded,
                      tint: category.color,
                      size: 44),
                  const SizedBox(width: TamamSpacing.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          category.name.resolve(language),
                          style: TamamType.headingSm
                              .toTextStyle(color: context.colors.textPrimary),
                        ),
                        if (category.description != null)
                          Text(
                            category.description!.resolve(language),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.bodySm.toTextStyle(
                                color: context.colors.textSecondary),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: TamamSpacing.s2),
                  // How this one is asked for, at a glance: the operator's
                  // setting, shown before the customer opens it.
                  StatusPill(
                    label: category.allowsInstant
                        ? l10n.serviceInstantBadge
                        : l10n.serviceScheduledBadge,
                    tone:
                        category.allowsInstant ? PillTone.brand : PillTone.info,
                    icon: category.allowsInstant
                        ? Icons.bolt_rounded
                        : Icons.event_rounded,
                    dense: true,
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
