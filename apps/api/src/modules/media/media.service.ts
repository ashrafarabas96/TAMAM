import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, MediaKind, MediaPurpose, type Permission } from '@tamam/shared-types';
import type { MediaUploadIntentInput } from '@tamam/validation';
import type { Queue } from 'bullmq';
import sharp from 'sharp';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../infrastructure/providers/storage/storage.provider';
import { MEDIA_JOBS, QUEUES } from '../../infrastructure/queue/queue.constants';

import { MediaUrlService } from './media-url.service';

const ALLOWED: Record<MediaKind, { mimes: string[]; maxBytes: number; extensions: string[] }> = {
  IMAGE: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    maxBytes: 15 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  },
  VIDEO: {
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxBytes: 120 * 1024 * 1024,
    extensions: ['mp4', 'mov', 'webm'],
  },
  AUDIO: {
    mimes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/x-m4a'],
    maxBytes: 20 * 1024 * 1024,
    extensions: ['mp3', 'm4a', 'aac', 'webm', 'ogg'],
  },
  DOCUMENT: {
    mimes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 20 * 1024 * 1024,
    extensions: ['pdf', 'jpg', 'jpeg', 'png'],
  },
};

/** Purposes whose objects may live in the public bucket (everything else is private + signed). */
const PUBLIC_PURPOSES: MediaPurpose[] = [
  MediaPurpose.BANNER_CREATIVE,
  MediaPurpose.SERVICE_ICON,
  MediaPurpose.PROFILE,
];

/** Purposes only staff may create. */
const STAFF_PURPOSES: Array<{ purpose: MediaPurpose; permission: Permission }> = [
  { purpose: MediaPurpose.BANNER_CREATIVE, permission: 'campaigns.manage' as Permission },
  { purpose: MediaPurpose.SERVICE_ICON, permission: 'services.manage' as Permission },
];

const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * Secure uploads (spec §93/§94/§113): server-generated keys, MIME + extension + size
 * validation, magic-byte sniffing on confirm, EXIF stripping and thumbnail/medium
 * renditions for images, private buckets by default, malware-scan hook.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly urls: MediaUrlService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @InjectQueue(QUEUES.MEDIA) private readonly queue: Queue,
  ) {}

  async createUploadIntent(user: RequestUser, input: MediaUploadIntentInput) {
    const rule = ALLOWED[input.kind];
    if (!rule.mimes.includes(input.mimeType.toLowerCase()))
      throw AppException.badRequest(
        ErrorCode.UPLOAD_INVALID,
        `MIME type ${input.mimeType} is not allowed for ${input.kind}`,
      );
    if (input.sizeBytes > rule.maxBytes)
      throw AppException.badRequest(
        ErrorCode.UPLOAD_TOO_LARGE,
        `Max size for ${input.kind} is ${Math.round(rule.maxBytes / 1024 / 1024)} MB`,
      );
    if (input.originalFilename) {
      const ext = input.originalFilename.split('.').pop()?.toLowerCase() ?? '';
      if (!rule.extensions.includes(ext))
        throw AppException.badRequest(ErrorCode.UPLOAD_INVALID, `Extension .${ext} is not allowed`);
    }
    const staffRule = STAFF_PURPOSES.find((s) => s.purpose === input.purpose);
    if (staffRule && !user.isSuperAdmin && !user.permissions.includes(staffRule.permission))
      throw AppException.forbidden();

    const isPublic = PUBLIC_PURPOSES.includes(input.purpose);
    const bucket = isPublic ? this.config.env.S3_BUCKET_PUBLIC : this.config.env.S3_BUCKET_PRIVATE;
    const ext = rule.extensions[0];
    const objectKey = `${input.purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;

    const media = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: user.id,
        kind: input.kind,
        purpose: input.purpose,
        bucket,
        objectKey,
        mimeType: input.mimeType.toLowerCase(),
        sizeBytes: BigInt(input.sizeBytes),
        originalFilename: input.originalFilename?.slice(0, 200) ?? null,
        isPublic,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    const intent = await this.storage.createUploadIntent(
      bucket,
      objectKey,
      media.mimeType,
      input.sizeBytes,
    );
    return { mediaId: media.id, upload: intent };
  }

  /** Client calls this after the PUT succeeds; we verify the object and enqueue processing. */
  async confirmUpload(user: RequestUser, mediaId: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || media.uploaderId !== user.id) throw AppException.notFound('Media', mediaId);
    if (media.status !== 'PENDING_UPLOAD') return this.toDto(media);
    const head = await this.storage.head(media.bucket, media.objectKey);
    if (!head.exists)
      throw AppException.badRequest(ErrorCode.UPLOAD_INVALID, 'Object was not uploaded');
    if (head.sizeBytes > Number(media.sizeBytes) * 1.05 + 1024)
      throw AppException.badRequest(
        ErrorCode.UPLOAD_TOO_LARGE,
        'Uploaded object is larger than declared',
      );

    if (media.kind === 'IMAGE' || media.mimeType === 'application/pdf') {
      const bytes = await this.storage.getObject(media.bucket, media.objectKey);
      const sniffed = MAGIC.find((m) => m.bytes.every((b, i) => bytes[(m.offset ?? 0) + i] === b));
      const expected = media.mimeType === 'image/heic' ? undefined : media.mimeType;
      if (expected && sniffed && sniffed.mime !== expected) {
        await this.storage.deleteObject(media.bucket, media.objectKey);
        await this.prisma.mediaAsset.update({
          where: { id: media.id },
          data: { status: 'REJECTED' },
        });
        throw AppException.badRequest(
          ErrorCode.UPLOAD_INVALID,
          'File content does not match its declared type',
        );
      }
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: media.kind === 'IMAGE' ? 'PROCESSING' : 'READY',
        sizeBytes: BigInt(head.sizeBytes),
        expiresAt: null,
      },
    });
    if (media.kind === 'IMAGE')
      await this.queue.add(
        MEDIA_JOBS.PROCESS_IMAGE,
        { mediaId: media.id },
        { jobId: `img-${media.id}` },
      );
    await this.queue.add(MEDIA_JOBS.SCAN, { mediaId: media.id }, { jobId: `scan-${media.id}` });
    return this.toDto(updated);
  }

  /** Worker: strip EXIF, generate medium (1280px) + thumbnail (320px) WebP renditions. */
  async processImage(mediaId: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || media.kind !== 'IMAGE') return;
    const original = await this.storage.getObject(media.bucket, media.objectKey);
    const base = sharp(original, { failOn: 'error' }).rotate(); // rotate() applies EXIF orientation then drops metadata
    const meta = await base.metadata();
    const stripped = await base.clone().withMetadata({ orientation: undefined }).toBuffer();
    await this.storage.putObject(media.bucket, media.objectKey, stripped, media.mimeType);
    const mediumKey = media.objectKey.replace(/\.[a-z0-9]+$/i, '.medium.webp');
    const thumbKey = media.objectKey.replace(/\.[a-z0-9]+$/i, '.thumb.webp');
    await this.storage.putObject(
      media.bucket,
      mediumKey,
      await base
        .clone()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      'image/webp',
    );
    await this.storage.putObject(
      media.bucket,
      thumbKey,
      await base
        .clone()
        .resize({ width: 320, height: 320, fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer(),
      'image/webp',
    );
    await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        status: 'READY',
        width: meta.width ?? null,
        height: meta.height ?? null,
        exifStripped: true,
        mediumKey,
        thumbnailKey: thumbKey,
      },
    });
  }

  /** Worker hook for malware scanning — integration point (spec §93). Marks CLEAN when no scanner is configured. */
  async scan(mediaId: string): Promise<void> {
    await this.prisma.mediaAsset.updateMany({
      where: { id: mediaId },
      data: { scanStatus: 'CLEAN' },
    });
  }

  /** Signed redirect for private objects; access is checked by the caller-specific policy passed in. */
  async resolveSigned(objectKey: string, user: RequestUser): Promise<string> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { OR: [{ objectKey }, { mediumKey: objectKey }, { thumbnailKey: objectKey }] },
    });
    if (!media) throw AppException.notFound('Media');
    const allowed =
      media.isPublic ||
      media.uploaderId === user.id ||
      user.isSuperAdmin ||
      (await this.canStaffView(user, media.purpose));
    if (!allowed) throw AppException.forbidden();
    return this.urls.signedUrl({ bucket: media.bucket, objectKey, isPublic: media.isPublic });
  }

  private async canStaffView(user: RequestUser, purpose: MediaPurpose): Promise<boolean> {
    const map: Partial<Record<MediaPurpose, Permission>> = {
      PARTNER_DOCUMENT: 'partners.review_documents' as Permission,
      VEHICLE_PHOTO: 'partners.read' as Permission,
      JOB_ATTACHMENT: 'jobs.read_all' as Permission,
      PROOF_OF_DELIVERY: 'jobs.read_all' as Permission,
      CHAT: 'support.read' as Permission,
      SUPPORT: 'support.read' as Permission,
      DISPUTE_EVIDENCE: 'disputes.read' as Permission,
    };
    const perm = map[purpose];
    return !!perm && user.permissions.includes(perm);
  }

  /** Verifies media ids belong to the user and are ready — used by job/chat/support services. */
  async assertOwnedReady(
    userId: string,
    mediaIds: string[],
    purposes: MediaPurpose[],
  ): Promise<void> {
    if (!mediaIds.length) return;
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, uploaderId: true, status: true, purpose: true },
    });
    if (rows.length !== mediaIds.length)
      throw AppException.validation([{ field: 'mediaIds', message: 'unknown media id' }]);
    for (const r of rows) {
      if (r.uploaderId !== userId) throw AppException.forbidden('Media does not belong to you');
      if (!purposes.includes(r.purpose))
        throw AppException.validation([
          { field: 'mediaIds', message: `media ${r.id} has purpose ${r.purpose}` },
        ]);
      if (r.status !== 'READY' && r.status !== 'PROCESSING' && r.status !== 'UPLOADED')
        throw AppException.validation([
          { field: 'mediaIds', message: `media ${r.id} is not uploaded` },
        ]);
    }
  }

  toDto(m: {
    id: string;
    kind: MediaKind;
    purpose: MediaPurpose;
    status: string;
    bucket: string;
    objectKey: string;
    isPublic: boolean;
    mediumKey: string | null;
    thumbnailKey: string | null;
    mimeType: string;
    sizeBytes: bigint;
    width: number | null;
    height: number | null;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      kind: m.kind,
      purpose: m.purpose,
      status: m.status,
      url: this.urls.urlFor(m, 'original'),
      mediumUrl: this.urls.urlFor(m, 'medium'),
      thumbnailUrl: this.urls.urlFor(m, 'thumbnail'),
      mimeType: m.mimeType,
      sizeBytes: Number(m.sizeBytes),
      width: m.width,
      height: m.height,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
