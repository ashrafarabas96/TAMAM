import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { SeedContext } from './context';
import { SEED_ASSET_SPECS, solidPng } from './png';

/**
 * Pushes the generated placeholder creatives into the object store.
 *
 * The seed used to only write these PNGs to disk and print "now run
 * scripts/seed-assets.sh". Nobody ran it — and it could not have worked from a
 * containerised stack anyway, because the seed writes the files inside the API
 * container while that script reads them from the host checkout. So every
 * MediaAsset row pointed at a key holding no bytes, the creative URLs answered
 * 404, and the customer home screen showed an empty banner area.
 *
 * Uploading here closes that gap: the process that invents the bytes is the one
 * that stores them, using the credentials it already holds. Idempotent — the
 * same object keys are overwritten on every run.
 */
export async function uploadSeedAssets(ctx: SeedContext): Promise<number> {
  const { config, summary } = ctx;
  const e = config.env;

  const client = new S3Client({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
  });

  let uploaded = 0;
  try {
    for (const spec of SEED_ASSET_SPECS) {
      const body = solidPng(spec.width, spec.height, spec.background, spec.accent);
      await client.send(
        new PutObjectCommand({
          Bucket: spec.bucket === 'public' ? e.S3_BUCKET_PUBLIC : e.S3_BUCKET_PRIVATE,
          Key: spec.objectKey,
          Body: body,
          ContentType: 'image/png',
          CacheControl: 'public, max-age=3600',
        }),
      );
      uploaded += 1;
    }
    summary.set('creatives uploaded', uploaded);
  } catch (err: unknown) {
    // A missing object store must not fail the seed: the database rows are still
    // correct and re-running the seed re-uploads. Say so plainly instead of
    // leaving a silent blank banner to be discovered on a phone.
    const reason = err instanceof Error ? err.message : String(err);
    summary.note(
      `could not upload creatives to ${e.S3_ENDPOINT} (${reason}) — banners will render their gradient fallback`,
    );
  } finally {
    client.destroy();
  }

  return uploaded;
}
