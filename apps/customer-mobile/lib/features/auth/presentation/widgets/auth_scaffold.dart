import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/offline_banner.dart';

/// Shared chrome for the sign-in pages: purple header block with the brand
/// mark, then a white sheet that holds the form.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
    super.key,
    this.footer,
    this.showBack = true,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? footer;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surfaceBrand,
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Padding(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + TamamSpacing.s2,
              left: TamamSpacing.s2,
              right: TamamSpacing.s2,
            ),
            child: Row(
              children: <Widget>[
                if (showBack && Navigator.of(context).canPop())
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                    color: colors.textOnBrand,
                  )
                else
                  const SizedBox(width: TamamSize.touchTargetMin),
                const Spacer(),
                const TamamWordmark(onBrand: true),
                const Spacer(),
                const SizedBox(width: TamamSize.touchTargetMin),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              TamamSpacing.s6,
              TamamSpacing.s5,
              TamamSpacing.s6,
              TamamSpacing.s6,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: TamamType.displaySm.toTextStyle(color: colors.textOnBrand),
                  ),
                ),
                const SizedBox(height: TamamSpacing.s2),
                Text(
                  subtitle,
                  style: TamamType.bodyMd.toTextStyle(color: TamamBrand.purple100),
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: colors.background,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.xxl)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  children: <Widget>[
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(TamamSpacing.s6),
                        child: child,
                      ),
                    ),
                    if (footer != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          TamamSpacing.s6,
                          0,
                          TamamSpacing.s6,
                          TamamSpacing.s5,
                        ),
                        child: footer,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The TAMAM wordmark drawn from type + a yellow dot, so no asset is needed.
class TamamWordmark extends StatelessWidget {
  const TamamWordmark({super.key, this.onBrand = false, this.fontSize = 26});

  final bool onBrand;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final Color base = onBrand ? colors.textOnBrand : colors.primary;
    return Semantics(
      label: 'TAMAM',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Text(
            'تمام',
            textDirection: TextDirection.rtl,
            style: TamamType.displaySm
                .toTextStyle(color: base)
                .copyWith(fontSize: fontSize, fontWeight: FontWeight.w800),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 3, right: 3),
            child: Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle),
            ),
          ),
        ],
      ),
    );
  }
}
