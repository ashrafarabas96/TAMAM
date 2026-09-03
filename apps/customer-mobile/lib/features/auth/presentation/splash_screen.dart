import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Restores the session, then hands over to the router's redirect.
///
/// It owns no navigation: it resolves [SessionController.bootstrap] and the
/// router decides where the resolved state belongs.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(sessionControllerProvider.notifier).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surfaceBrand,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const TamamWordmark(onBrand: true, fontSize: 44),
            const SizedBox(height: TamamSpacing.s3),
            Text(
              context.l10n.appTagline,
              style: TamamType.bodyMd.toTextStyle(color: TamamBrand.purple100),
            ),
            const SizedBox(height: TamamSpacing.s8),
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.6, color: colors.accent),
            ),
          ],
        ),
      ),
    );
  }
}
