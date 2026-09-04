import type { MediaUploadIntentInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { MediaAssetDto, UploadIntentResponse } from '@/lib/api/types';

export const mediaApi = {
  createUploadIntent: (input: MediaUploadIntentInput) =>
    api.post<UploadIntentResponse>('/media/upload-intents', input),
  confirm: (mediaId: string) => api.post<MediaAssetDto>(`/media/${mediaId}/confirm`),
};

/**
 * Three-step upload: intent → signed PUT straight to object storage → confirm. Resolves with the
 * confirmed asset (status PROCESSING for images until EXIF stripping/thumbnails finish).
 */
export async function uploadMedia(
  file: File,
  purpose: MediaUploadIntentInput['purpose'],
  kind: MediaUploadIntentInput['kind'] = 'IMAGE',
): Promise<MediaAssetDto> {
  const intent = await mediaApi.createUploadIntent({
    purpose,
    kind,
    mimeType: file.type,
    sizeBytes: file.size,
    originalFilename: file.name,
  });
  const put = await fetch(intent.upload.uploadUrl, {
    method: 'PUT',
    headers: intent.upload.headers,
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed with status ${put.status}`);
  return mediaApi.confirm(intent.mediaId);
}
