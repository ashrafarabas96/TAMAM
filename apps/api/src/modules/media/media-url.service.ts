import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_PROVIDER, type StorageProvider } from '../../infrastructure/providers/storage/storage.provider';
import { RedisService } from '../../infrastructure/redis/redis.service';

export interface MediaRef {
  bucket: string;
  objectKey: string;
  isPublic: boolean;
  mediumKey?: string | null;
  thumbnailKey?: string | null;
}

const SIGNED_TTL = 900; // 15 min

/**
 * Produces URLs for stored media: public objects get a CDN-style URL, private ones a
 * short-lived signed URL (cached in Redis to avoid re-signing on every list call).
 */
@Injectable()
export class MediaUrlService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly redis: RedisService,
  ) {}

  /** Synchronous variant for DTO mappers: public → direct URL; private → API proxy path resolved lazily. */
  urlFor(ref: MediaRef, variant: 'original' | 'medium' | 'thumbnail' = 'medium'): string {
    const key = variant === 'thumbnail' ? (ref.thumbnailKey ?? ref.objectKey) : variant === 'medium' ? (ref.mediumKey ?? ref.objectKey) : ref.objectKey;
    if (ref.isPublic) return this.storage.publicUrl(ref.bucket, key);
    // Private objects are served through a signed redirect endpoint so DTOs stay synchronous.
    return `/api/v1/media/${encodeURIComponent(key)}/view`;
  }

  async signedUrl(ref: MediaRef, variant: 'original' | 'medium' | 'thumbnail' = 'original', downloadName?: string): Promise<string> {
    const key = variant === 'thumbnail' ? (ref.thumbnailKey ?? ref.objectKey) : variant === 'medium' ? (ref.mediumKey ?? ref.objectKey) : ref.objectKey;
    if (ref.isPublic) return this.storage.publicUrl(ref.bucket, key);
    const cacheKey = `media:url:${ref.bucket}:${key}:${downloadName ?? ''}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) return cached;
    const url = await this.storage.getSignedReadUrl(ref.bucket, key, SIGNED_TTL, downloadName);
    await this.redis.client.set(cacheKey, url, 'EX', SIGNED_TTL - 60);
    return url;
  }
}
