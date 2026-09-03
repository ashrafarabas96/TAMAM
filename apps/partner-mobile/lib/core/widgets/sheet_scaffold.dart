import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// The standard modal sheet: 24-radius top corners, drag handle, safe-area and
/// keyboard-aware padding, and an optional sticky footer action.
class SheetScaffold extends StatelessWidget {
  const SheetScaffold({
    required this.title,
    required this.child,
    super.key,
    this.subtitle,
    this.footer,
    this.trailing,
    this.scrollable = true,
    this.maxHeightFactor = 0.88,
  });

  final String title;
  final Widget child;
  final String? subtitle;
  final Widget? footer;
  final Widget? trailing;
  final bool scrollable;
  final double maxHeightFactor;

  /// Opens [builder] with the platform-correct modal configuration.
  static Future<T?> show<T>(BuildContext context, WidgetBuilder builder, {bool dismissible = true}) =>
      showModalBottomSheet<T>(
        context: context,
        isScrollControlled: true,
        isDismissible: dismissible,
        enableDrag: dismissible,
        useSafeArea: true,
        builder: builder,
      );

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final double maxHeight = MediaQuery.sizeOf(context).height * maxHeightFactor;
    final Widget body = Padding(
      padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s5),
      child: child,
    );

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              TamamSpacing.s5,
              TamamSpacing.s1,
              TamamSpacing.s3,
              TamamSpacing.s3,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Semantics(
                        header: true,
                        child: Text(
                          title,
                          style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                        ),
                      ),
                      if (subtitle != null) ...<Widget>[
                        const SizedBox(height: TamamSpacing.s1),
                        Text(
                          subtitle!,
                          style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          Flexible(child: scrollable ? SingleChildScrollView(child: body) : body),
          if (footer != null)
            Padding(
              padding: EdgeInsets.fromLTRB(
                TamamSpacing.s5,
                TamamSpacing.s4,
                TamamSpacing.s5,
                TamamSpacing.s5 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: footer,
            )
          else
            SizedBox(height: TamamSpacing.s5 + MediaQuery.viewInsetsOf(context).bottom),
        ],
      ),
    );
  }
}
