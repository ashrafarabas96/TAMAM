import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// What a completed upload hands back to the caller.
class DocumentUploadResult {
  const DocumentUploadResult({
    required this.type,
    required this.mediaId,
    this.number,
    this.issuedAt,
    this.expiresAt,
  });

  final DocumentType type;
  final String mediaId;
  final String? number;

  /// `YYYY-MM-DD`, as `partnerDocumentUploadSchema` requires.
  final String? issuedAt;
  final String? expiresAt;
}

/// Photographs (or picks) a document, uploads it with purpose
/// `PARTNER_DOCUMENT`, and collects the number and expiry the reviewer needs.
///
/// The three-step media flow (intent → PUT → confirm) lives in
/// `MediaRepository`; this sheet only owns the form around it, so the same
/// widget serves onboarding and later re-uploads.
class DocumentUploadSheet extends ConsumerStatefulWidget {
  const DocumentUploadSheet({required this.type, super.key});

  final DocumentType type;

  static Future<DocumentUploadResult?> show(BuildContext context, {required DocumentType type}) =>
      SheetScaffold.show<DocumentUploadResult>(context, (BuildContext _) => DocumentUploadSheet(type: type));

  @override
  ConsumerState<DocumentUploadSheet> createState() => _DocumentUploadSheetState();
}

class _DocumentUploadSheetState extends ConsumerState<DocumentUploadSheet> {
  final TextEditingController _number = TextEditingController();
  Attachment? _file;
  DateTime? _expiresAt;
  bool _busy = false;

  bool get _needsNumber => OnboardingFlow.hasNumber(widget.type);
  bool get _needsExpiry => OnboardingFlow.expiresFor(widget.type);

  bool get _valid {
    if (_file?.mediaId == null || _busy) return false;
    if (_needsNumber && _number.text.trim().length < 2) return false;
    if (_needsExpiry && _expiresAt == null) return false;
    return true;
  }

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  static String _isoDate(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  Future<void> _pick({required bool fromCamera}) async {
    setState(() => _busy = true);
    try {
      final MediaRepository media = ref.read(mediaRepositoryProvider);
      final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: 1);
      if (picked.isEmpty || !mounted) return;
      setState(() => _file = picked.first.copyWith(uploading: true));
      final Attachment uploaded = await media.upload(picked.first, purpose: MediaPurpose.partnerDocument);
      if (mounted) setState(() => _file = uploaded);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _file = _file?.copyWith(uploading: false, failed: true));
      AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickExpiry() async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _expiresAt ?? DateTime(now.year + 1, now.month, now.day),
      firstDate: now,
      lastDate: DateTime(now.year + 20),
    );
    if (picked != null) setState(() => _expiresAt = picked);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Attachment? file = _file;

    return SheetScaffold(
      title: JobLabels.documentType(l10n, widget.type),
      subtitle: l10n.documentUploadHint,
      footer: TamamButton(
        label: l10n.actionSave,
        busy: _busy,
        onPressed: _valid
            ? () => Navigator.of(context).pop(
                  DocumentUploadResult(
                    type: widget.type,
                    mediaId: file!.mediaId!,
                    number: _needsNumber ? _number.text.trim() : null,
                    expiresAt: _expiresAt == null ? null : _isoDate(_expiresAt!),
                  ),
                )
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (file == null)
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => unawaited(_pick(fromCamera: true)),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: Text(l10n.mediaCamera),
                  ),
                ),
                const SizedBox(width: TamamSpacing.s2),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => unawaited(_pick(fromCamera: false)),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: Text(l10n.mediaGallery),
                  ),
                ),
              ],
            )
          else
            Stack(
              children: <Widget>[
                ClipRRect(
                  borderRadius: BorderRadius.circular(TamamRadius.md),
                  child: Image.file(
                    File(file.localPath),
                    height: 180,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (BuildContext _, Object __, StackTrace? ___) => Container(
                      height: 180,
                      color: colors.skeleton,
                      child: Icon(Icons.broken_image_outlined, color: colors.textTertiary),
                    ),
                  ),
                ),
                if (file.uploading)
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.overlay,
                        borderRadius: BorderRadius.circular(TamamRadius.md),
                      ),
                      child: const Center(child: CircularProgressIndicator(color: TamamNeutral.n0)),
                    ),
                  ),
                PositionedDirectional(
                  top: TamamSpacing.s1,
                  end: TamamSpacing.s1,
                  child: IconButton.filledTonal(
                    tooltip: l10n.actionChange,
                    onPressed: _busy ? null : () => setState(() => _file = null),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ),
              ],
            ),
          if (file != null && file.failed)
            Padding(
              padding: const EdgeInsets.only(top: TamamSpacing.s2),
              child: Text(l10n.documentUploadFailed, style: TamamType.bodySm.toTextStyle(color: colors.danger)),
            ),
          if (_needsNumber) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            TextField(
              controller: _number,
              textDirection: TextDirection.ltr,
              maxLength: 60,
              onChanged: (String _) => setState(() {}),
              decoration: InputDecoration(labelText: l10n.documentNumber, counterText: ''),
            ),
          ],
          if (_needsExpiry) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            InkWell(
              onTap: () => unawaited(_pickExpiry()),
              borderRadius: BorderRadius.circular(TamamRadius.button),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: l10n.documentExpiryDate,
                  suffixIcon: const Icon(Icons.calendar_today_rounded, size: TamamSize.iconSm),
                ),
                child: Text(
                  _expiresAt == null ? l10n.documentExpiryHint : _isoDate(_expiresAt!),
                  textDirection: TextDirection.ltr,
                  style: TamamType.bodyLg.toTextStyle(
                    color: _expiresAt == null ? colors.textTertiary : colors.textPrimary,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: TamamSpacing.s3),
        ],
      ),
    );
  }
}
