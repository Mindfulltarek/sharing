import { del } from '@vercel/blob';
import { currentTimeMs, getDb } from './db';
import { blobCredentials } from './blob';

const STALE_UPLOAD_MS = 2 * 60 * 60 * 1000;
const CRON_BATCH_SIZE = 200;

export async function runExpirationCleanup() {
  const sql = getDb();
  const now = currentTimeMs();
  const expiredRows = await sql`
    SELECT f.id, f.blob_path
    FROM sharing_project_files f JOIN sharing_projects p ON p.id = f.project_id
    WHERE p.expires_at_ms IS NOT NULL AND p.expires_at_ms <= ${now} AND f.status = 'ready'
    ORDER BY p.expires_at_ms ASC LIMIT ${CRON_BATCH_SIZE}
  `;
  const staleProjectIntents = await sql`
    SELECT id, blob_path FROM sharing_upload_intents
    WHERE created_at_ms <= ${now - STALE_UPLOAD_MS} ORDER BY created_at_ms ASC LIMIT ${CRON_BATCH_SIZE}
  `;
  const staleVaultIntents = await sql`
    SELECT id, blob_path FROM sharing_vault_upload_intents
    WHERE created_at_ms <= ${now - STALE_UPLOAD_MS} ORDER BY created_at_ms ASC LIMIT ${CRON_BATCH_SIZE}
  `;
  const staleIntents = [...staleProjectIntents, ...staleVaultIntents];
  const paths = [...expiredRows, ...staleIntents].map((row) => String(row.blob_path));
  if (paths.length) await del(paths, blobCredentials());
  for (const row of expiredRows) {
    await sql`UPDATE sharing_project_files SET status = 'expired' WHERE id = ${row.id} AND status = 'ready'`;
  }
  for (const row of staleProjectIntents) await sql`DELETE FROM sharing_upload_intents WHERE id = ${row.id}`;
  for (const row of staleVaultIntents) await sql`DELETE FROM sharing_vault_upload_intents WHERE id = ${row.id}`;
  return {
    expiredFilesRemoved: expiredRows.length,
    staleUploadIntentsRemoved: staleIntents.length,
    ranAt: now,
  };
}
