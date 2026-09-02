export interface UploadIntent {
  /** Pre-signed PUT URL the client uploads to directly. */
  uploadUrl: string;
  /** Headers the client must send with the PUT. */
  headers: Record<string, string>;
  /** Seconds the URL stays valid. */
  expiresInSeconds: number;
}

export interface StorageObjectInfo {
  exists: boolean;
  sizeBytes: number;
  contentType: string | null;
}

/** Object storage abstraction (spec §183). Private buckets + signed URLs by default (spec §93). */
export interface StorageProvider {
  readonly name: string;
  createUploadIntent(bucket: string, key: string, contentType: string, sizeBytes: number): Promise<UploadIntent>;
  getSignedReadUrl(bucket: string, key: string, expiresInSeconds: number, downloadName?: string): Promise<string>;
  publicUrl(bucket: string, key: string): string;
  head(bucket: string, key: string): Promise<StorageObjectInfo>;
  getObject(bucket: string, key: string): Promise<Buffer>;
  putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
