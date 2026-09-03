import 'package:flutter/widgets.dart';
import 'package:tamam_partner/l10n/generated/app_localizations.dart';

export 'package:tamam_partner/l10n/generated/app_localizations.dart';

/// Single import point for translations.
///
/// `lib/l10n/generated/` is produced by `flutter gen-l10n` (see README); this
/// file exists so features import `package:tamam_partner/l10n/l10n.dart` and
/// never the generated path directly.
extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

/// The locales the app ships with. Arabic is first: it is the default.
const List<Locale> supportedAppLocales = <Locale>[Locale('ar'), Locale('en')];
