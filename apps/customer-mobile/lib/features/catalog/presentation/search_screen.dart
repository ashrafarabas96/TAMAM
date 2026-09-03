import 'package:flutter/material.dart';
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
  const SearchScreen({super.key, this.urgentOnly = false});

  /// Entered from the "خدمة عاجلة" tile: pre-filters to urgent-capable services.
  final bool urgentOnly;

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
        title: Text(widget.urgentOnly ? l10n.serviceUrgent : l10n.searchTitle),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(TamamSize.inputHeight + TamamSpacing.s4),
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
      body: searching ? _Results(query: _query) : _Directory(urgentOnly: widget.urgentOnly),
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
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: serviceColorFor(hit.jobType).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(TamamRadius.sm),
                  ),
                  child: Icon(
                    Icons.handyman_rounded,
                    size: TamamSize.iconMd,
                    color: serviceColorFor(hit.jobType),
                  ),
                ),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        hit.name.resolve(language),
                        style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                      ),
                      Text(
                        hit.categoryName.resolve(language),
                        style: TamamType.bodySm.toTextStyle(color: context.colors.textTertiary),
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
  const _Directory({required this.urgentOnly});

  final bool urgentOnly;

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
      isEmpty: (List<ServiceCategory> all) => _filter(all).isEmpty,
      emptyTitle: l10n.searchDirectoryEmptyTitle,
      emptyMessage: l10n.searchDirectoryEmptyBody,
      emptyIcon: Icons.handyman_outlined,
      builder: (List<ServiceCategory> all) {
        final List<ServiceCategory> categories = _filter(all);
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
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: category.color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(TamamRadius.sm),
                    ),
                    child: Icon(Icons.build_rounded, color: category.color),
                  ),
                  const SizedBox(width: TamamSpacing.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          category.name.resolve(language),
                          style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                        ),
                        if (category.description != null)
                          Text(
                            category.description!.resolve(language),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.bodySm.toTextStyle(color: context.colors.textSecondary),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  List<ServiceCategory> _filter(List<ServiceCategory> all) => urgentOnly
      ? all
          .where(
            (ServiceCategory c) =>
                c.urgencyLevels.contains(JobUrgency.urgent) || c.urgencyLevels.contains(JobUrgency.emergency),
          )
          .toList(growable: false)
      : all;
}
