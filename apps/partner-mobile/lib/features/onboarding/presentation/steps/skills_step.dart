import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/catalog/domain/catalog.dart';
import 'package:tamam_partner/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 3 (technicians and service providers only): which categories the
/// partner can serve, free-text skills and years of experience.
///
/// The categories come from `GET /catalog/categories?jobType=HOME_SERVICE`;
/// each one may demand extra documents, which the documents step then asks for.
class SkillsStep extends ConsumerStatefulWidget {
  const SkillsStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<SkillsStep> createState() => _SkillsStepState();
}

class _SkillsStepState extends ConsumerState<SkillsStep> {
  late Set<String> _categoryIds = widget.state.profile?.categoryIds.toSet() ?? <String>{};
  late List<String> _skills = List<String>.of(widget.state.profile?.skills ?? const <String>[]);
  final TextEditingController _skill = TextEditingController();
  final TextEditingController _years = TextEditingController();

  @override
  void dispose() {
    _skill.dispose();
    _years.dispose();
    super.dispose();
  }

  void _addSkill() {
    final String value = _skill.text.trim();
    if (value.length < 2 || _skills.length >= 30 || _skills.contains(value)) return;
    setState(() {
      _skills = <String>[..._skills, value];
      _skill.clear();
    });
  }

  Future<void> _save() async {
    final int? years = int.tryParse(PhoneFormatter.digitsOnly(_years.text));
    await ref.read(onboardingProvider.notifier).saveSkills(
          categoryIds: _categoryIds.toList(growable: false),
          skills: _skills,
          yearsOfExperience: years,
        );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingSkillsHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
        const SizedBox(height: TamamSpacing.s4),
        SizedBox(
          height: 260,
          child: AsyncView<List<ServiceCategory>>(
            value: ref.watch(serviceCategoriesProvider),
            onRetry: () => ref.invalidate(serviceCategoriesProvider),
            isEmpty: (List<ServiceCategory> items) => items.isEmpty,
            emptyTitle: l10n.onboardingNoCategories,
            emptyIcon: Icons.handyman_outlined,
            builder: (List<ServiceCategory> categories) => SingleChildScrollView(
              child: Wrap(
                spacing: TamamSpacing.s2,
                runSpacing: TamamSpacing.s2,
                children: <Widget>[
                  for (final ServiceCategory category in categories)
                    FilterChip(
                      label: Text(category.name.resolve(language)),
                      selected: _categoryIds.contains(category.id),
                      onSelected: (bool selected) => setState(() {
                        _categoryIds = selected
                            ? <String>{..._categoryIds, category.id}
                            : _categoryIds.where((String id) => id != category.id).toSet();
                      }),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: TamamSpacing.s4),
        TextField(
          controller: _years,
          keyboardType: TextInputType.number,
          textDirection: TextDirection.ltr,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]')),
            LengthLimitingTextInputFormatter(2),
          ],
          decoration: InputDecoration(labelText: l10n.onboardingYearsOfExperience),
        ),
        const SizedBox(height: TamamSpacing.s3),
        TextField(
          controller: _skill,
          textInputAction: TextInputAction.done,
          onSubmitted: (String _) => _addSkill(),
          decoration: InputDecoration(
            labelText: l10n.onboardingSkillsLabel,
            helperText: l10n.onboardingSkillsHelper,
            suffixIcon: IconButton(
              tooltip: l10n.actionAdd,
              onPressed: _addSkill,
              icon: const Icon(Icons.add_rounded),
            ),
          ),
        ),
        if (_skills.isNotEmpty) ...<Widget>[
          const SizedBox(height: TamamSpacing.s2),
          Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: <Widget>[
              for (final String skill in _skills)
                InputChip(
                  label: Text(skill),
                  onDeleted: () => setState(() => _skills = _skills.where((String s) => s != skill).toList(growable: false)),
                ),
            ],
          ),
        ],
        if (widget.state.failure != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Text(localizedFailure(l10n, widget.state.failure!), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
        ],
        const SizedBox(height: TamamSpacing.s6),
        TamamButton(
          label: l10n.actionNext,
          busy: widget.state.busy,
          onPressed: _categoryIds.isEmpty ? null : () => unawaited(_save()),
        ),
      ],
    );
  }
}
