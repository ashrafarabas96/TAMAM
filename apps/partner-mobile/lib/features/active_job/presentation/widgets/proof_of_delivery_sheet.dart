import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/pin_input.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/signature_pad.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/media/presentation/widgets/attachment_picker.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Proof of delivery, in one of two shapes:
///  * the delivery OTP the recipient reads out (when the job requires one), or
///  * the receiver's name + a photo (required) + an optional signature.
///
/// Media is uploaded with purpose `PROOF_OF_DELIVERY` before `complete` is
/// sent, so the server can assert ownership of every media id it receives.
class ProofOfDeliverySheet extends ConsumerStatefulWidget {
  const ProofOfDeliverySheet({required this.job, super.key, this.errorText});

  final Job job;
  final String? errorText;

  static Future<ProofOfDelivery?> show(BuildContext context, {required Job job, String? errorText}) =>
      SheetScaffold.show<ProofOfDelivery>(
        context,
        (BuildContext _) => ProofOfDeliverySheet(job: job, errorText: errorText),
      );

  @override
  ConsumerState<ProofOfDeliverySheet> createState() => _ProofOfDeliverySheetState();
}

class _ProofOfDeliverySheetState extends ConsumerState<ProofOfDeliverySheet> {
  final GlobalKey<SignaturePadState> _signatureKey = GlobalKey<SignaturePadState>();
  final TextEditingController _receiver = TextEditingController();
  late bool _useOtp = widget.job.deliveryOtpRequired;
  String _otp = '';
  List<Attachment> _photos = <Attachment>[];
  bool _hasSignature = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _receiver.text = widget.job.delivery?.recipientName ?? '';
  }

  @override
  void dispose() {
    _receiver.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    if (_busy) return false;
    if (_useOtp) return _otp.length >= 4;
    return _receiver.text.trim().isNotEmpty && _photos.any((Attachment a) => a.isReady);
  }

  Future<void> _addPhoto({required bool fromCamera}) async {
    final MediaRepository media = ref.read(mediaRepositoryProvider);
    final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: 1);
    if (picked.isEmpty || !mounted) return;
    final Attachment pending = picked.first.copyWith(uploading: true);
    setState(() => _photos = <Attachment>[pending]);
    try {
      final Attachment uploaded = await media.upload(pending, purpose: MediaPurpose.proofOfDelivery);
      if (mounted) setState(() => _photos = <Attachment>[uploaded]);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _photos = <Attachment>[pending.copyWith(uploading: false, failed: true)]);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  Future<void> _submit() async {
    if (_useOtp) {
      Navigator.of(context).pop(ProofOfDelivery(deliveryOtp: _otp));
      return;
    }
    setState(() => _busy = true);
    try {
      String? signatureMediaId;
      final Uint8List? png = await _signatureKey.currentState?.toPngBytes();
      if (png != null) {
        final Directory dir = await getTemporaryDirectory();
        final File file = File('${dir.path}/signature-${widget.job.id}.png');
        await file.writeAsBytes(png, flush: true);
        final Attachment uploaded = await ref.read(mediaRepositoryProvider).upload(
              Attachment(localPath: file.path, mimeType: 'image/png', sizeBytes: png.length),
              purpose: MediaPurpose.proofOfDelivery,
            );
        signatureMediaId = uploaded.mediaId;
      }
      if (!mounted) return;
      Navigator.of(context).pop(
        ProofOfDelivery(
          receiverName: _receiver.text.trim(),
          photoMediaId: _photos.firstWhere((Attachment a) => a.isReady).mediaId,
          signatureMediaId: signatureMediaId,
        ),
      );
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String? recipient = widget.job.delivery?.recipientName;

    return SheetScaffold(
      title: l10n.podTitle,
      subtitle: recipient == null || recipient.isEmpty ? l10n.podSubtitle : l10n.podSubtitleNamed(recipient),
      footer: TamamButton(
        label: l10n.jobActionDeliver,
        busy: _busy,
        onPressed: _canSubmit ? () => unawaited(_submit()) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (widget.job.deliveryOtpRequired)
            SegmentedButton<bool>(
              segments: <ButtonSegment<bool>>[
                ButtonSegment<bool>(value: true, label: Text(l10n.podModeOtp), icon: const Icon(Icons.pin_rounded)),
                ButtonSegment<bool>(value: false, label: Text(l10n.podModeManual), icon: const Icon(Icons.edit_note_rounded)),
              ],
              selected: <bool>{_useOtp},
              onSelectionChanged: (Set<bool> next) => setState(() => _useOtp = next.first),
            ),
          const SizedBox(height: TamamSpacing.s4),
          if (_useOtp) ...<Widget>[
            Text(l10n.podOtpHint, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
            const SizedBox(height: TamamSpacing.s3),
            PinInput(
              length: 4,
              hasError: widget.errorText != null,
              onChanged: (String value) => setState(() => _otp = value),
              onCompleted: (String _) {},
            ),
            if (widget.errorText != null) ...<Widget>[
              const SizedBox(height: TamamSpacing.s2),
              Text(widget.errorText!, style: TamamType.bodySm.toTextStyle(color: colors.danger)),
            ],
          ] else ...<Widget>[
            TextField(
              controller: _receiver,
              textCapitalization: TextCapitalization.words,
              maxLength: 80,
              onChanged: (String _) => setState(() {}),
              decoration: InputDecoration(labelText: l10n.podReceiverName, counterText: ''),
            ),
            const SizedBox(height: TamamSpacing.s3),
            AttachmentPicker(
              attachments: _photos,
              maxItems: 1,
              label: l10n.podPhotoLabel,
              hint: l10n.podPhotoHint,
              onAdd: ({required bool fromCamera}) => unawaited(_addPhoto(fromCamera: fromCamera)),
              onRemove: (String _) => setState(() => _photos = <Attachment>[]),
            ),
            const SizedBox(height: TamamSpacing.s3),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(l10n.podSignatureLabel, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
                ),
                if (_hasSignature)
                  TextButton(
                    onPressed: () => _signatureKey.currentState?.clear(),
                    child: Text(l10n.actionClear),
                  ),
              ],
            ),
            SignaturePad(
              key: _signatureKey,
              semanticLabel: l10n.podSignatureLabel,
              height: 150,
              onChanged: (bool has) => setState(() => _hasSignature = has),
            ),
            const SizedBox(height: TamamSpacing.s1),
            Text(l10n.podSignatureHint, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
          ],
          const SizedBox(height: TamamSpacing.s3),
        ],
      ),
    );
  }
}
