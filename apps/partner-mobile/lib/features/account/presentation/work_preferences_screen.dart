import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// What the partner is registered for, and what they want offered right now.
///
/// Two different things live here, deliberately separated:
///  * **registered** roles / categories / zones — the approved profile; editing
///    them re-posts the onboarding step, which may send the change to review;
///  * **active** roles — a per-shift filter that only rides along with
///    `PUT /partners/me/availability` and changes nothing in the profile.
class WorkPreferencesScreen extends ConsumerStatefulWidget {
  const WorkPreferencesScreen({super.key});

  @override
  ConsumerState<WorkPreferencesScreen> createState() => _WorkPreferencesScreenState();
}

class _WorkPreferencesScreenState extends ConsumerState<WorkPreferencesScreen> {
  Set<PartnerRoleType>? _activeRoles;
  Set<String>? _zoneIds;
  Set<String>? _categoryIds;
  bool _busy = false;

  /// The active-role choice is a device preference: the availability sheet
  /// pre-selects it, and it reaches the server with the next ONLINE call.
  Future<void> _persistActiveRoles(Set<PartnerRoleType> roles) => ref.read(prefsStoreProvider).setStringList(
        PrefsStore.keyActiveRoles,
        roles.map((PartnerRoleType r) => r.value).toList(growable: false),
      );

  Future<void> _saveZones() async {
    final Set<String>? zones = _zoneIds;
    if (zones == null || zones.isEmpty) return;
    setState(() => _busy = true);
    try {
      // The onboarding route refuses an approved file; this screen is only ever reached
      // after approval, so it edits the service profile instead.
      await ref
          .read(onboardingRepositoryProvider)
          .updateServiceProfile(zoneIds: zones.toList(growable: false));
      ref.invalidate(partnerProfileProvider);
      if (mounted) AppFeedback.showMessage(context, context.l10n.workPreferencesSaved, icon: Icons.check_rounded);
    } on AppFailure catch (failure) {
      if (mounted) AppFeedback.showFailure(context, failure);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveCategories() async {
    final Set<String>? categories = _categoryIds;
    if (categories == null || categories.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(onboardingRepositoryProvider)
          .updateServiceProfile(categoryIds: categories.toList(growable: false));
      ref.invalidate(partnerProfileProvider);
      if (mounted) AppFeedback.showMessage(context, context.l10n.workPreferencesSaved, icon: Icons.check_rounded);
    } on AppFailure catch (failure) {
      if (mounted) AppFeedback.showFailure(context, failure);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;
    final AvailabilityState availability = ref.watch(availabilityControllerProvider);
    final List<ServiceCategory> categories = ref.watch(serviceCategoriesProvider).valueOrNull ?? const <ServiceCategory>[];
    final List<ServiceZone> zones = ref.watch(serviceZonesProvider).valueOrNull ?? const <ServiceZone>[];

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.workPreferencesTitle)),
      body: AsyncView<PartnerProfile>(
        value: ref.watch(partnerProfileProvider),
        onRetry: () => ref.invalidate(partnerProfileProvider),
        builder: (PartnerProfile profile) {
          final Set<PartnerRoleType> active = _activeRoles ??
              (availability.activeRoles.isEmpty ? profile.roles.toSet() : availability.activeRoles.toSet());
          final Set<String> zoneIds = _zoneIds ?? profile.zoneIds.toSet();
          final Set<String> categoryIds = _categoryIds ?? profile.categoryIds.toSet();

          return ListView(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            children: <Widget>[
              _Section(title: l10n.workPreferencesActiveRoles, hint: l10n.workPreferencesActiveRolesHint),
              TamamCard(
                child: Column(
                  children: <Widget>[
                    for (final PartnerRoleType role in profile.roles)
                      SwitchListTile.adaptive(
                        value: active.contains(role),
                        contentPadding: EdgeInsets.zero,
                        secondary: Icon(JobLabels.roleIcon(role), color: colors.primary),
                        title: Text(JobLabels.role(l10n, role)),
                        onChanged: (bool value) {
                          final Set<PartnerRoleType> next = value
                              ? <PartnerRoleType>{...active, role}
                              : active.where((PartnerRoleType r) => r != role).toSet();
                          // At least one role must stay on, or dispatch has
                          // nothing to offer.
                          if (next.isEmpty) return;
                          setState(() => _activeRoles = next);
                          unawaited(_persistActiveRoles(next));
                        },
                      ),
                    if (availability.isOnline)
                      Padding(
                        padding: const EdgeInsets.only(top: TamamSpacing.s2),
                        child: Text(
                          l10n.workPreferencesRolesApplyNextShift,
                          style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: TamamSpacing.s5),
              _Section(title: l10n.workPreferencesZones, hint: l10n.workPreferencesZonesHint),
              TamamCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Wrap(
                      spacing: TamamSpacing.s2,
                      runSpacing: TamamSpacing.s2,
                      children: <Widget>[
                        for (final ServiceZone zone in zones)
                          FilterChip(
                            label: Text(zone.name.resolve(language)),
                            selected: zoneIds.contains(zone.id),
                            onSelected: (bool selected) => setState(() {
                              _zoneIds = selected
                                  ? <String>{...zoneIds, zone.id}
                                  : zoneIds.where((String id) => id != zone.id).toSet();
                            }),
                          ),
                      ],
                    ),
                    const SizedBox(height: TamamSpacing.s3),
                    TamamButton(
                      label: l10n.actionSave,
                      variant: TamamButtonVariant.outline,
                      busy: _busy,
                      onPressed: zoneIds.isEmpty || _zoneIds == null ? null : () => unawaited(_saveZones()),
                    ),
                  ],
                ),
              ),
              if (profile.isServiceProvider) ...<Widget>[
                const SizedBox(height: TamamSpacing.s5),
                _Section(title: l10n.workPreferencesCategories, hint: l10n.workPreferencesCategoriesHint),
                TamamCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Wrap(
                        spacing: TamamSpacing.s2,
                        runSpacing: TamamSpacing.s2,
                        children: <Widget>[
                          for (final ServiceCategory category in categories)
                            FilterChip(
                              label: Text(category.name.resolve(language)),
                              selected: categoryIds.contains(category.id),
                              onSelected: (bool selected) => setState(() {
                                _categoryIds = selected
                                    ? <String>{...categoryIds, category.id}
                                    : categoryIds.where((String id) => id != category.id).toSet();
                              }),
                            ),
                        ],
                      ),
                      const SizedBox(height: TamamSpacing.s3),
                      Text(
                        l10n.workPreferencesCategoriesReviewNotice,
                        style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                      ),
                      const SizedBox(height: TamamSpacing.s2),
                      TamamButton(
                        label: l10n.actionSave,
                        variant: TamamButtonVariant.outline,
                        busy: _busy,
                        onPressed: categoryIds.isEmpty || _categoryIds == null ? null : () => unawaited(_saveCategories()),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: TamamSpacing.s8),
            ],
          );
        },
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.hint});

  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: TamamSpacing.s2, left: 4, right: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text(title, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
          ),
          Text(hint, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
        ],
      ),
    );
  }
}
