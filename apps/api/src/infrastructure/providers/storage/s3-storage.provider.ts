import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../config';

import type { StorageObjectInfo, StorageProvider, UploadIntent } from './storage.provider';

/** S3-compatible adapter: AWS S3, MinIO (local), Cloudflare R2, DigitalOcean Spaces… */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;

  constructor(private readonly config: AppConfigService) {
    const e = config.env;
    this.client = new S3Client({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
    });
  }

  async createUploadIntent(
    bucket: string,
    key: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<UploadIntent> {
    const expiresInSeconds = 600;
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
    return { uploadUrl, headers: { 'Content-Type': contentType }, expiresInSeconds };
  }

  async getSignedReadUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
    downloadName?: string,
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(downloadName
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadName)}"`,
          }
        : {}),
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  publicUrl(bucket: string, key: string): string {
    if (bucket === this.config.env.S3_BUCKET_PUBLIC)
      return `${this.config.env.S3_PUBLIC_BASE_URL}/${key}`;
    return `${this.config.env.S3_ENDPOINT}/${bucket}/${key}`;
  }

  async head(bucket: string, key: string): Promise<StorageObjectInfo> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        exists: true,
        sizeBytes: Number(res.ContentLength ?? 0),
        contentType: res.ContentType ?? null,
      };
    } catch {
      return { exists: false, sizeBytes: 0, contentType: null };
    }
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return Buffer.from(bytes ?? new Uint8Array());
  }

  async putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.env.S3_BUCKET_PRIVATE }));
      return true;
    } catch {
      return false;
    }
  }
}
