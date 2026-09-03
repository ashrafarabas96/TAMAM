import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/avatar.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/onboarding/data/onboarding_repository.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Step 1: who the partner is, plus the profile photo.
class PersonalStep extends ConsumerStatefulWidget {
  const PersonalStep({required this.state, super.key});

  final OnboardingState state;

  @override
  ConsumerState<PersonalStep> createState() => _PersonalStepState();
}

class _PersonalStepState extends ConsumerState<PersonalStep> {
  late final TextEditingController _name = TextEditingController(text: widget.state.profile?.fullName ?? '');
  final TextEditingController _email = TextEditingController();
  final TextEditingController _nationalId = TextEditingController();
  final TextEditingController _city = TextEditingController();
  DateTime? _dateOfBirth;
  String? _photoMediaId;
  String? _photoUrl;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _photoUrl = widget.state.profile?.profileImageUrl;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _nationalId.dispose();
    _city.dispose();
    super.dispose();
  }

  bool get _valid =>
      _name.text.trim().length >= 3 &&
      _nationalId.text.trim().length >= 5 &&
      _city.text.trim().length >= 2 &&
      _dateOfBirth != null;

  /// `YYYY-MM-DD`, which is what `partnerOnboardingPersonalSchema` requires.
  static String _isoDate(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 80),
      // The platform requires partners to be adults.
      lastDate: DateTime(now.year - 18, now.month, now.day),
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _pickPhoto() async {
    setState(() => _uploading = true);
    try {
      final MediaRepository media = ref.read(mediaRepositoryProvider);
      final List<Attachment> picked = await media.pickImages(fromCamera: false, limit: 1);
      if (picked.isEmpty) return;
      final Attachment uploaded = await media.upload(picked.first, purpose: MediaPurpose.profile);
      if (!mounted) return;
      setState(() {
        _photoMediaId = uploaded.mediaId;
        _photoUrl = uploaded.localPath;
      });
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    await ref.read(onboardingProvider.notifier).savePersonal(
          PersonalInfoInput(
            fullName: _name.text,
            dateOfBirth: _isoDate(_dateOfBirth!),
            nationalId: _nationalId.text,
            city: _city.text,
            email: _email.text,
            profileImageMediaId: _photoMediaId,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AppFailure? failure = widget.state.failure;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Center(
          child: Stack(
            children: <Widget>[
              TamamAvatar(
                initials: _name.text.isEmpty ? '#' : _name.text.trim().substring(0, 1),
                imageUrl: _photoUrl,
                size: 96,
              ),
              PositionedDirectional(
                bottom: 0,
                end: 0,
                child: Material(
                  color: colors.primary,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _uploading ? null : () => unawaited(_pickPhoto()),
                    child: SizedBox(
                      width: 34,
                      height: 34,
                      child: _uploading
                          ? const Padding(
                              padding: EdgeInsets.all(8),
                              child: CircularProgressIndicator(strokeWidth: 2, color: TamamNeutral.n0),
                            )
                          : Icon(Icons.photo_camera_rounded, size: 18, color: colors.textOnBrand),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: TamamSpacing.s2),
        Text(
          l10n.onboardingPhotoHint,
          textAlign: TextAlign.center,
          style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
        ),
        const SizedBox(height: TamamSpacing.s5),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          onChanged: (String _) => setState(() {}),
          decoration: InputDecoration(
            labelText: l10n.onboardingFullName,
            errorText: failure?.errorFor('fullName'),
          ),
        ),
        const SizedBox(height: TamamSpacing.s3),
        TextField(
          controller: _nationalId,
          keyboardType: TextInputType.number,
          textDirection: TextDirection.ltr,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]')),
            LengthLimitingTextInputFormatter(30),
          ],
          onChanged: (String value) {
            final String digits = PhoneFormatter.digitsOnly(value);
            if (digits != value) {
              _nationalId.value = TextEditingValue(text: digits, selection: TextSelection.collapsed(offset: digits.length));
            }
            setState(() {});
          },
          decoration: InputDecoration(
            labelText: l10n.onboardingNationalId,
            errorText: failure?.errorFor('nationalId'),
          ),
        ),
        const SizedBox(height: TamamSpacing.s3),
        InkWell(
          onTap: () => unawaited(_pickDate()),
          borderRadius: BorderRadius.circular(TamamRadius.button),
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: l10n.onboardingDateOfBirth,
              errorText: failure?.errorFor('dateOfBirth'),
              suffixIcon: const Icon(Icons.calendar_today_rounded, size: TamamSize.iconSm),
            ),
            child: Text(
              _dateOfBirth == null ? l10n.onboardingDateOfBirthHint : _isoDate(_dateOfBirth!),
              textDirection: TextDirection.ltr,
              style: TamamType.bodyLg.toTextStyle(
                color: _dateOfBirth == null ? colors.textTertiary : colors.textPrimary,
              ),
            ),
          ),
        ),
        const SizedBox(height: TamamSpacing.s3),
        TextField(
          controller: _city,
          textCapitalization: TextCapitalization.words,
          onChanged: (String _) => setState(() {}),
          decoration: InputDecoration(labelText: l10n.onboardingCity, errorText: failure?.errorFor('city')),
        ),
        const SizedBox(height: TamamSpacing.s3),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: l10n.onboardingEmailOptional,
            errorText: failure?.errorFor('email'),
          ),
        ),
        if (failure != null && failure.fieldErrors.isEmpty) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Text(localizedFailure(l10n, failure), style: TamamType.bodySm.toTextStyle(color: colors.danger)),
        ],
        const SizedBox(height: TamamSpacing.s6),
        TamamButton(
          label: l10n.actionNext,
          busy: widget.state.busy,
          onPressed: _valid ? () => unawaited(_save()) : null,
        ),
      ],
    );
  }
}
