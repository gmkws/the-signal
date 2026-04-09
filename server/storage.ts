/**
 * File storage via Cloudflare R2 (S3-compatible)
 *
 * Uses @aws-sdk/client-s3 with R2's S3-compatible endpoint.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME      — Bucket name (e.g. the-signal-media)
 *   R2_PUBLIC_URL       — Public URL for the bucket (r2.dev URL or custom domain)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from './_core/env';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
      throw new Error(
        "R2 storage not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
      );
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ENV.r2AccessKeyId,
        secretAccessKey: ENV.r2SecretAccessKey,
      },
    });
  }
  return s3Client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const key = normalizeKey(relKey);
  const body = typeof data === 'string' ? Buffer.from(data) : data;

  await client.send(new PutObjectCommand({
    Bucket: ENV.r2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  // Build public URL
  const publicUrl = ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`
    : `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2BucketName}/${key}`;

  console.log(`[Storage] Uploaded ${key} (${body.length} bytes) → ${publicUrl}`);
  return { key, url: publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const publicUrl = ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`
    : `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2BucketName}/${key}`;

  return { key, url: publicUrl };
}
