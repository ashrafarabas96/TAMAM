import 'dart:io';

import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// A row of attached photos with add / remove affordances.
///
/// Uploads run in the background, so each tile shows its own progress and
/// failure state instead of blocking the form.
class AttachmentPicker extends StatelessWidget {
  const AttachmentPicker({
    required this.attachments,
    required this.onAdd,
    required this.onRemove,
    super.key,
    this.maxItems = 6,
    this.label,
    this.hint,
  });

  final List<Attachment> attachments;

  /// `fromCamera` distinguishes the camera button from the gallery button.
  final void Function({required bool fromCamera}) onAdd;
  final ValueChanged<String> onRemove;
  final int maxItems;
  final String? label;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final bool canAdd = attachments.length < maxItems;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label ?? l10n.mediaAttachPhotos,
          style: TamamType.labelLg.toTextStyle(color: colors.textSecondary),
        ),
        if (hint != null)
          Text(
            hint!,
            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
          ),
        const SizedBox(height: TamamSpacing.s2),
        SizedBox(
          height: 84,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: <Widget>[
              for (final Attachment attachment in attachments)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: TamamSpacing.s2),
                  child: _AttachmentTile(
                    attachment: attachment,
                    onRemove: () => onRemove(attachment.localPath),
                    removeLabel: l10n.actionRemove,
                  ),
                ),
              if (canAdd) ...<Widget>[
                _AddTile(
                  icon: Icons.photo_library_outlined,
                  label: l10n.mediaGallery,
                  onTap: () => onAdd(fromCamera: false),
                ),
                const SizedBox(width: TamamSpacing.s2),
                _AddTile(
                  icon: Icons.photo_camera_outlined,
                  label: l10n.mediaCamera,
                  onTap: () => onAdd(fromCamera: true),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({
    required this.attachment,
    required this.onRemove,
    required this.removeLabel,
  });

  final Attachment attachment;
  final VoidCallback onRemove;
  final String removeLabel;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return SizedBox(
      width: 84,
      height: 84,
      child: Stack(
        children: <Widget>[
          ClipRRect(
            borderRadius: BorderRadius.circular(TamamRadius.md),
            child: Image.file(
              File(attachment.localPath),
              width: 84,
              height: 84,
              fit: BoxFit.cover,
              errorBuilder: (BuildContext _, Object __, StackTrace? ___) => Container(
                color: colors.skeleton,
                child: Icon(Icons.broken_image_outlined, color: colors.textTertiary),
              ),
            ),
          ),
          if (attachment.uploading)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.overlay,
                  borderRadius: BorderRadius.circular(TamamRadius.md),
                ),
                child: const Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: TamamNeutral.n0),
                  ),
                ),
              ),
            ),
          if (attachment.failed)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.dangerSoft.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(TamamRadius.md),
                ),
                child: Icon(Icons.error_outline_rounded, color: colors.danger),
              ),
            ),
          PositionedDirectional(
            top: -6,
            end: -6,
            child: IconButton(
              tooltip: removeLabel,
              iconSize: 18,
              onPressed: onRemove,
              icon: CircleAvatar(
                radius: 11,
                backgroundColor: TamamNeutral.n1000.withOpacity(0.6),
                child: const Icon(Icons.close_rounded, size: 13, color: TamamNeutral.n0),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TamamRadius.md),
        child: Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            color: colors.surfaceAlt,
            borderRadius: BorderRadius.circular(TamamRadius.md),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Icon(icon, color: colors.primary),
              const SizedBox(height: 2),
              Text(
                label,
                style: TamamType.labelSm.toTextStyle(color: colors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
