/**
 * File storage via Cloudflare R2 (S3-compatible)
 *
 * Uses AWS SDK v3 with R2's S3-compatible endpoint.
 * Uploads images and files, returns public URLs.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME      — Bucket name (e.g. the-signal-media)
 *   R2_PUBLIC_URL       — Public URL for the bucket (custom domain or r2.dev URL)
 */

import { ENV } from './_core/env';

// Simple S3-compatible upload using presigned-style PUT with AWS Signature V4
// We use fetch directly to avoid adding @aws-sdk as a dependency

import { createHmac, createHash } from 'crypto';

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Buffer | string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);
  const service = 's3';

  headers['x-amz-date'] = amzDate;
  headers['x-amz-content-sha256'] = sha256(body);

  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderKeys.join(';');

  const canonicalHeaders = signedHeaderKeys
    .map(k => `${k}:${headers[Object.keys(headers).find(h => h.toLowerCase() === k)!].trim()}`)
    .join('\n') + '\n';

  const canonicalQueryString = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

function assertStorageConfig() {
  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey || !ENV.r2BucketName) {
    throw new Error(
      "R2 storage not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; url: string }> {
  assertStorageConfig();

  const key = normalizeKey(relKey);
  const endpoint = `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`;
  const url = new URL(`/${ENV.r2BucketName}/${key}`, endpoint);
  const body = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);

  const headers: Record<string, string> = {
    'Host': url.host,
    'Content-Type': contentType,
    'Content-Length': String(body.length),
  };

  const signedHeaders = signRequest(
    'PUT',
    url,
    headers,
    body,
    ENV.r2AccessKeyId,
    ENV.r2SecretAccessKey,
    'auto'
  );

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: signedHeaders,
    body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`R2 upload failed (${response.status}): ${message}`);
  }

  // Build public URL
  const publicUrl = ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`
    : `${endpoint}/${ENV.r2BucketName}/${key}`;

  return { key, url: publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  assertStorageConfig();

  const key = normalizeKey(relKey);
  const publicUrl = ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`
    : `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2BucketName}/${key}`;

  return { key, url: publicUrl };
}
