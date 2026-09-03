import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/session/user.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/avatar.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/media/data/media_repository.dart';
import 'package:tamam_customer/features/media/presentation/media_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Edit the profile: photo, name and e-mail. The phone number is the identity
/// and can only be changed by support.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  bool _busy = false;
  bool _uploadingPhoto = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    final User? user = ref.read(sessionControllerProvider).user;
    _name = TextEditingController(text: user?.fullName ?? '');
    _email = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final String email = _email.text.trim();
      final User updated = await ref.read(sessionRepositoryProvider).updateProfile(
            fullName: _name.text.trim(),
            email: email.isEmpty ? null : email,
            clearEmail: email.isEmpty,
          );
      ref.read(sessionControllerProvider.notifier).setUser(updated);
      if (mounted) AppFeedback.showMessage(context, context.l10n.profileSaved, icon: Icons.check_rounded);
    } on Object catch (error) {
      if (mounted) setState(() => _failure = asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changePhoto() async {
    setState(() => _uploadingPhoto = true);
    try {
      final MediaRepository media = ref.read(mediaRepositoryProvider);
      final List<Attachment> picked = await media.pickImages(fromCamera: false, limit: 1);
      if (picked.isEmpty) return;
      final Attachment uploaded = await media.upload(picked.first, purpose: MediaPurpose.profile);
      final User updated = await ref.read(sessionRepositoryProvider).updateProfile(
            profileImageMediaId: uploaded.mediaId,
          );
      ref.read(sessionControllerProvider.notifier).setUser(updated);
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final User? user = ref.watch(sessionControllerProvider).user;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          Center(
            child: Stack(
              children: <Widget>[
                TamamAvatar(
                  initials: user?.initials ?? '#',
                  imageUrl: user?.profileImageUrl,
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
                      onTap: _uploadingPhoto ? null : () => unawaited(_changePhoto()),
                      child: SizedBox(
                        width: 34,
                        height: 34,
                        child: _uploadingPhoto
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
          const SizedBox(height: TamamSpacing.s6),
          TamamCard(
            child: Column(
              children: <Widget>[
                TextField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(
                    labelText: l10n.nameFieldLabel,
                    errorText: _failure?.errorFor('fullName'),
                  ),
                ),
                const SizedBox(height: TamamSpacing.s3),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: l10n.profileEmail,
                    errorText: _failure?.errorFor('email'),
                  ),
                ),
                const SizedBox(height: TamamSpacing.s3),
                TextField(
                  enabled: false,
                  controller: TextEditingController(text: user?.phone ?? ''),
                  textDirection: TextDirection.ltr,
                  decoration: InputDecoration(
                    labelText: l10n.profilePhone,
                    helperText: l10n.profilePhoneLocked,
                  ),
                ),
              ],
            ),
          ),
          if (_failure != null && _failure!.fieldErrors.isEmpty) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            Text(
              localizedFailure(l10n, _failure!),
              style: TamamType.bodySm.toTextStyle(color: colors.danger),
            ),
          ],
          const SizedBox(height: TamamSpacing.s5),
          TamamButton(
            label: l10n.actionSave,
            busy: _busy,
            onPressed: () => unawaited(_save()),
          ),
        ],
      ),
    );
  }
}
