import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// One onboarding slide, described declaratively so the copy comes from ARB.
class _Slide {
  const _Slide({
    required this.title,
    required this.body,
    required this.icon,
    required this.accent,
  });

  final String title;
  final String body;
  final IconData icon;
  final Color accent;
}

/// Three slides that explain the four services before asking for a phone number.
///
/// The illustrations are composed from theme shapes and Material icons rather
/// than bitmaps: they follow dark mode and cost nothing in the bundle.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await ref.read(prefsStoreProvider).setBool(PrefsStore.keyOnboardingSeen, value: true);
    if (!mounted) return;
    context.go(Routes.phone);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<_Slide> slides = <_Slide>[
      _Slide(
        title: l10n.onboardingRideTitle,
        body: l10n.onboardingRideBody,
        icon: Icons.local_taxi_rounded,
        accent: TamamServiceColors.ride,
      ),
      _Slide(
        title: l10n.onboardingDeliveryTitle,
        body: l10n.onboardingDeliveryBody,
        icon: Icons.inventory_2_rounded,
        accent: TamamServiceColors.delivery,
      ),
      _Slide(
        title: l10n.onboardingServicesTitle,
        body: l10n.onboardingServicesBody,
        icon: Icons.handyman_rounded,
        accent: TamamServiceColors.homeService,
      ),
    ];
    final bool isLast = _index == slides.length - 1;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: TamamSpacing.s4,
                vertical: TamamSpacing.s2,
              ),
              child: Row(
                children: <Widget>[
                  const TamamWordmark(fontSize: 22),
                  const Spacer(),
                  TextButton(
                    onPressed: () => unawaited(_finish()),
                    child: Text(l10n.actionSkip),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: slides.length,
                onPageChanged: (int index) => setState(() => _index = index),
                itemBuilder: (BuildContext context, int index) => _SlideView(slide: slides[index]),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List<Widget>.generate(
                slides.length,
                (int i) => AnimatedContainer(
                  duration: TamamMotion.durationBase,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 22 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: i == _index ? colors.primary : colors.borderStrong,
                    borderRadius: BorderRadius.circular(TamamRadius.pill),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(TamamSpacing.s6),
              child: TamamButton(
                label: isLast ? l10n.onboardingStart : l10n.actionNext,
                onPressed: () {
                  if (isLast) {
                    unawaited(_finish());
                    return;
                  }
                  unawaited(
                    _controller.nextPage(
                      duration: TamamMotion.durationBase,
                      curve: Curves.easeOut,
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s6),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          _Illustration(icon: slide.icon, accent: slide.accent),
          const SizedBox(height: TamamSpacing.s8),
          Text(
            slide.title,
            textAlign: TextAlign.center,
            style: TamamType.displaySm.toTextStyle(color: colors.textPrimary),
          ),
          const SizedBox(height: TamamSpacing.s3),
          Text(
            slide.body,
            textAlign: TextAlign.center,
            style: TamamType.bodyLg.toTextStyle(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Concentric brand circles with the service icon — the illustration placeholder
/// the design brief calls for, drawn entirely from tokens.
class _Illustration extends StatelessWidget {
  const _Illustration({required this.icon, required this.accent});

  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return SizedBox(
      width: 220,
      height: 220,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(color: colors.surfaceBrandSoft, shape: BoxShape.circle),
          ),
          Positioned(
            top: 12,
            right: 18,
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle),
            ),
          ),
          Positioned(
            bottom: 26,
            left: 10,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: accent.withOpacity(0.35),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Container(
            width: 140,
            height: 140,
            decoration: BoxDecoration(
              color: colors.surface,
              shape: BoxShape.circle,
              boxShadow: TamamElevation.raised,
            ),
            child: Icon(icon, size: 64, color: accent),
          ),
        ],
      ),
    );
  }
}
