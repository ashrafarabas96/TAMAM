import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/banners/presentation/banner_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Language and appearance.
///
/// Changing the language applies instantly (the whole app re-renders RTL/LTR)
/// and is pushed to the profile so server-sent messages follow it.
class PreferencesScreen extends ConsumerWidget {
  const PreferencesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Locale locale = ref.watch(localeControllerProvider);
    final ThemeMode themeMode = ref.watch(themeModeControllerProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.preferencesTitle)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          _SectionTitle(title: l10n.preferencesLanguage),
          TamamCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                RadioListTile<String>(
                  value: 'ar',
                  groupValue: locale.languageCode,
                  title: const Text('العربية'),
                  onChanged: (String? value) => unawaited(_setLanguage(ref, value)),
                ),
                Divider(height: 1, color: colors.border),
                RadioListTile<String>(
                  value: 'en',
                  groupValue: locale.languageCode,
                  title: const Text('English'),
                  onChanged: (String? value) => unawaited(_setLanguage(ref, value)),
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s5),
          _SectionTitle(title: l10n.preferencesAppearance),
          TamamCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                for (final ThemeMode mode in ThemeMode.values) ...<Widget>[
                  if (mode != ThemeMode.values.first) Divider(height: 1, color: colors.border),
                  RadioListTile<ThemeMode>(
                    value: mode,
                    groupValue: themeMode,
                    title: Text(_themeLabel(l10n, mode)),
                    onChanged: (ThemeMode? value) {
                      if (value != null) unawaited(ref.read(themeModeControllerProvider.notifier).set(value));
                    },
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s5),
          Text(
            l10n.preferencesNotificationsMovedHint,
            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
          ),
        ],
      ),
    );
  }

  Future<void> _setLanguage(WidgetRef ref, String? value) async {
    if (value == null) return;
    await ref.read(localeControllerProvider.notifier).setLanguage(value);
    // Creatives and catalogue copy are language-specific, so the caches go.
    await ref.read(bannerFeedRepositoryProvider).invalidateAll();
    try {
      await ref.read(sessionRepositoryProvider).updateProfile(language: value);
      await ref.read(sessionControllerProvider.notifier).refreshUser();
    } on Object {
      // The local switch already happened; the server copy syncs next time.
    }
  }

  String _themeLabel(AppLocalizations l10n, ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return l10n.themeSystem;
      case ThemeMode.light:
        return l10n.themeLight;
      case ThemeMode.dark:
        return l10n.themeDark;
    }
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: TamamSpacing.s2, left: 4, right: 4),
        child: Semantics(
          header: true,
          child: Text(title, style: TamamType.labelMd.toTextStyle(color: context.colors.textTertiary)),
        ),
      );
}
