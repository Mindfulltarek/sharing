import { ApiError } from './errors';

export function blobCredentials() {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (oidcToken && storeId) return { access: 'private' as const, oidcToken, storeId };
  if (readWriteToken) return { access: 'private' as const, token: readWriteToken };
  throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Private Blob storage is not configured yet.');
}

export function assertPresignedUploadConfigured() {
  blobCredentials();
  if (!process.env.BLOB_WEBHOOK_PUBLIC_KEY) {
    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Configure the private Blob webhook public key before accepting uploads.');
  }
}
