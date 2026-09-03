import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';

/// A file the customer attached, tracked through its three-step upload.
class Attachment {
  const Attachment({
    required this.localPath,
    required this.mimeType,
    required this.sizeBytes,
    this.mediaId,
    this.uploading = false,
    this.failed = false,
  });

  final String localPath;
  final String mimeType;
  final int sizeBytes;

  /// Set once the upload is confirmed; this is what job bodies reference.
  final String? mediaId;
  final bool uploading;
  final bool failed;

  bool get isReady => mediaId != null;

  File get file => File(localPath);

  Attachment copyWith({String? mediaId, bool? uploading, bool? failed}) => Attachment(
        localPath: localPath,
        mimeType: mimeType,
        sizeBytes: sizeBytes,
        mediaId: mediaId ?? this.mediaId,
        uploading: uploading ?? this.uploading,
        failed: failed ?? this.failed,
      );
}

/// Uploads attachments through the platform's three-step flow:
/// intent → direct PUT to storage → confirm.
///
/// The API never proxies file bytes, so the app talks to the pre-signed URL
/// directly and only tells the API when the object exists.
class MediaRepository {
  const MediaRepository(this._api);

  final ApiClient _api;

  /// Uploads one picked file and returns it with its `mediaId` filled in.
  Future<Attachment> upload(Attachment attachment, {required MediaPurpose purpose}) async {
    final String kind = _kindFor(attachment.mimeType);
    final JsonMap intent = await _api.postObject(
      ApiPaths.mediaUploadIntents,
      body: <String, Object?>{
        'purpose': purpose.value,
        'kind': kind,
        'mimeType': attachment.mimeType,
        'sizeBytes': attachment.sizeBytes,
        'originalFilename': attachment.localPath.split(Platform.pathSeparator).last,
      },
    );

    final String mediaId = readStringOr(intent, 'mediaId', '');
    final JsonMap upload = asJsonMap(intent['upload']) ?? const <String, Object?>{};
    final Uri? uploadUrl = Uri.tryParse(readStringOr(upload, 'uploadUrl', ''));
    if (mediaId.isEmpty || uploadUrl == null) {
      throw const FormatException('Upload intent was incomplete');
    }

    final Map<String, String> headers = <String, String>{'Content-Type': attachment.mimeType};
    final JsonMap? extraHeaders = asJsonMap(upload['headers']);
    extraHeaders?.forEach((String key, Object? value) {
      if (value is String) headers[key] = value;
    });

    await _api.putBinary(uploadUrl, await attachment.file.readAsBytes(), headers: headers);
    await _api.postObject(ApiPaths.mediaConfirm(mediaId));
    return attachment.copyWith(mediaId: mediaId, uploading: false, failed: false);
  }

  /// Picks images from the gallery or the camera, already downscaled.
  Future<List<Attachment>> pickImages({required bool fromCamera, int limit = 6}) async {
    final ImagePicker picker = ImagePicker();
    if (fromCamera) {
      final XFile? shot = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
        maxWidth: 1920,
      );
      return shot == null ? const <Attachment>[] : _toAttachments(<XFile>[shot]);
    }
    final List<XFile> files = await picker.pickMultiImage(imageQuality: 82, maxWidth: 1920);
    return _toAttachments(files.take(limit));
  }

  Future<Attachment?> pickVideo({required bool fromCamera}) async {
    final XFile? file = await ImagePicker().pickVideo(
      source: fromCamera ? ImageSource.camera : ImageSource.gallery,
      maxDuration: const Duration(seconds: 60),
    );
    if (file == null) return null;
    final List<Attachment> attachments = await _toAttachments(<XFile>[file]);
    return attachments.isEmpty ? null : attachments.first;
  }

  Future<List<Attachment>> _toAttachments(Iterable<XFile> files) async {
    final List<Attachment> out = <Attachment>[];
    for (final XFile file in files) {
      out.add(
        Attachment(
          localPath: file.path,
          mimeType: file.mimeType ?? _mimeFromPath(file.path),
          sizeBytes: await file.length(),
        ),
      );
    }
    return out;
  }

  String _kindFor(String mimeType) {
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.startsWith('image/')) return 'IMAGE';
    return 'DOCUMENT';
  }

  String _mimeFromPath(String path) {
    final String ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      default:
        return 'image/jpeg';
    }
  }
}
