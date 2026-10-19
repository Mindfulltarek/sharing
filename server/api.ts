import { del, get, head, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { Hono } from 'hono';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from './auth';
import { authenticateGoogleRequest } from './auth';
import { currentTimeMs, getDb } from './db';
import { blobCredentials, assertPresignedUploadConfigured } from './blob';
import { runExpirationCleanup } from './expiration-cleanup';
import { ApiError, errorResponse, parseExpiresAt, requireText } from './errors';
import { cleanFileName, cleanRelativePath, hashIpAddress, hashPassphrase, issueScopedToken, randomShareToken, userPathKey, verifyPassphrase, verifyScopedToken } from './security';

interface ApiVariables {
  user: AuthenticatedUser;
  presignedBody: HandleUploadPresignedBody;
}
type ApiEnvironment = { Variables: ApiVariables };

interface ProjectFileView {
  id: string;
  name: string;
  size: number;
  type: string;
  modifiedAt: number;
  relativePath?: string;
  downloadCount: number;
  available: boolean;
}
interface ProjectView {
  id: string;
  token: string | null;
  name: string;
  files: ProjectFileView[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  privacy: 'open' | 'password' | 'private';
  views: number;
  downloads: number;
  ownerLabel?: string;
}

const api = new Hono<ApiEnvironment>();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

api.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');
  c.header('X-Frame-Options', 'DENY');
  await next();
});

api.use('/api/v1/*', async (c, next) => {
  const path = c.req.path;
  if (path === '/api/v1/health' || path.startsWith('/api/v1/public/shares/') || path === '/api/v1/cron/expire') {
    return next();
  }

  if (path === '/api/v1/blob/upload-handler') {
    const body = await readJson(c) as unknown as HandleUploadPresignedBody;
    c.set('presignedBody', body);
    // Blob completion callbacks are accepted only after the SDK verifies the signed callback.
    if (body && typeof body === 'object' && body.type === 'blob.upload-completed') return next();
  }

  c.set('user', await authenticateGoogleRequest(c.req.raw));
  return next();
});

api.onError((error, c) => {
  const result = errorResponse(error);
  return c.json(result.body, result.status as 400);
});
api.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'That API route does not exist.' } }, 404));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(c: { req: { json: () => Promise<unknown> } }) {
  try {
    const value = await c.req.json();
    if (!isRecord(value)) throw new ApiError(400, 'INVALID_JSON', 'A JSON object is required.');
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_JSON', 'The request body must be valid JSON.');
  }
}

function validateUuid(value: string, label = 'ID') {
  if (!UUID_RE.test(value)) throw new ApiError(404, 'NOT_FOUND', `${label} was not found.`);
  return value;
}

function userFrom(c: { get: (key: 'user') => AuthenticatedUser }) {
  return c.get('user');
}

function safeContentType(value: unknown) {
  if (typeof value !== 'string') return 'application/octet-stream';
  const mime = value.split(';', 1)[0].trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+*-]+$/.test(mime)) return 'application/octet-stream';
  return mime.slice(0, 255);
}

function toProjectFile(row: Record<string, unknown>): ProjectFileView {
  const relativePath = typeof row.relative_path === 'string' ? row.relative_path : undefined;
  return {
    id: String(row.file_id),
    name: String(row.file_name),
    size: Number(row.file_size),
    type: String(row.file_type || 'application/octet-stream'),
    modifiedAt: Number(row.file_created_at),
    ...(relativePath ? { relativePath } : {}),
    downloadCount: Number(row.file_download_count ?? 0),
    available: row.file_status === 'ready',
  };
}

function foldProjectRows(rows: Record<string, unknown>[]): ProjectView[] {
  const projects = new Map<string, ProjectView>();
  for (const row of rows) {
    const id = String(row.project_id);
    let project = projects.get(id);
    if (!project) {
      const privacy = row.privacy as ProjectView['privacy'];
      project = {
        id,
        token: typeof row.share_token === 'string' ? row.share_token : null,
        name: String(row.project_name),
        files: [],
        createdAt: Number(row.project_created_at),
        updatedAt: Number(row.project_updated_at),
        expiresAt: row.expires_at_ms === null ? null : Number(row.expires_at_ms),
        privacy,
        views: Number(row.views ?? 0),
        downloads: Number(row.downloads ?? 0),
        ...(typeof row.owner_label === 'string' ? { ownerLabel: row.owner_label } : {}),
      };
      projects.set(id, project);
    }
    if (row.file_id && row.file_status !== 'pending') project.files.push(toProjectFile(row));
  }
  return [...projects.values()];
}

async function getOwnedProject(sql: ReturnType<typeof getDb>, ownerSub: string, projectId: string) {
  const rows = await sql`
    SELECT id, owner_sub, name, privacy, share_token, share_password_hash, expires_at_ms,
      created_at_ms, updated_at_ms, views, downloads
    FROM sharing_projects WHERE id = ${projectId} AND owner_sub = ${ownerSub} LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

async function getOwnedProjectView(sql: ReturnType<typeof getDb>, ownerSub: string, projectId: string) {
  const rows = await sql`
    SELECT
      p.id AS project_id, p.name AS project_name, p.privacy, p.share_token,
      p.created_at_ms AS project_created_at, p.updated_at_ms AS project_updated_at,
      p.expires_at_ms, p.views, p.downloads, u.display_name AS owner_label,
      f.id AS file_id, f.name AS file_name, f.relative_path, f.content_type AS file_type,
      f.size_bytes AS file_size, f.created_at_ms AS file_created_at,
      f.download_count AS file_download_count, f.status AS file_status
    FROM sharing_projects p
    JOIN sharing_users u ON u.google_sub = p.owner_sub
    LEFT JOIN sharing_project_files f ON f.project_id = p.id
    WHERE p.owner_sub = ${ownerSub} AND p.id = ${projectId}
    ORDER BY f.created_at_ms ASC
  `;
  return foldProjectRows(rows as Record<string, unknown>[])[0];
}

async function publicProjectQuery(sql: ReturnType<typeof getDb>, token: string) {
  return sql`
    SELECT
      p.id AS project_id, p.name AS project_name, p.privacy, p.share_token,
      p.created_at_ms AS project_created_at, p.updated_at_ms AS project_updated_at,
      p.expires_at_ms, p.views, p.downloads, u.display_name AS owner_label,
      f.id AS file_id, f.name AS file_name, f.relative_path, f.content_type AS file_type,
      f.size_bytes AS file_size, f.created_at_ms AS file_created_at,
      f.download_count AS file_download_count, f.status AS file_status
    FROM sharing_projects p
    JOIN sharing_users u ON u.google_sub = p.owner_sub
    LEFT JOIN sharing_project_files f ON f.project_id = p.id
    WHERE p.share_token = ${token} AND p.privacy <> 'private'
    ORDER BY f.created_at_ms ASC
  `;
}

async function lookupShare(sql: ReturnType<typeof getDb>, token: string) {
  const rows = await sql`
    SELECT id, owner_sub, name, privacy, share_token, share_password_hash, expires_at_ms,
      created_at_ms, updated_at_ms, views, downloads
    FROM sharing_projects
    WHERE share_token = ${token} AND privacy <> 'private'
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

function projectIsExpired(project: Record<string, unknown>) {
  return project.expires_at_ms !== null && Number(project.expires_at_ms) <= currentTimeMs();
}

function makeDownloadHeaders(name: string, contentType: string, size: number) {
  const safeFallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_').slice(0, 150) || 'download';
  const headers = new Headers({
    'Content-Type': safeContentType(contentType),
    'Content-Disposition': `attachment; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  if (Number.isSafeInteger(size) && size >= 0) headers.set('Content-Length', String(size));
  return headers;
}

async function streamBlob(pathname: string, name: string, contentType: string, size: number) {
  const blob = await get(pathname, blobCredentials());
  if (!blob || blob.statusCode !== 200) throw new ApiError(404, 'FILE_NOT_FOUND', 'The file is no longer available.');
  return new Response(blob.stream, { status: 200, headers: makeDownloadHeaders(name, contentType || blob.blob.contentType, size) });
}

function requestIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || c.req.header('x-real-ip') || 'unknown';
}

function rateLimitPepper() {
  const pepper = process.env.SHARE_RATE_LIMIT_PEPPER || process.env.ACCESS_TOKEN_SECRET;
  if (!pepper || pepper.length < 32) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Configure a 32-character rate-limit pepper.');
  return pepper;
}

async function recordRateLimitAttempt(sql: ReturnType<typeof getDb>, table: 'sharing_share_password_attempts' | 'sharing_vault_attempts', ownerId: string, ipDigest: string, now: number, maxAttempts: number) {
  const windowMs = 15 * 60 * 1000;
  const rows = table === 'sharing_share_password_attempts'
    ? await sql`
        INSERT INTO sharing_share_password_attempts (project_id, ip_digest, window_started_at_ms, attempts)
        VALUES (${ownerId}, ${ipDigest}, ${now}, 1)
        ON CONFLICT (project_id, ip_digest) DO UPDATE SET
          attempts = CASE WHEN sharing_share_password_attempts.window_started_at_ms <= ${now - windowMs} THEN 1 ELSE sharing_share_password_attempts.attempts + 1 END,
          window_started_at_ms = CASE WHEN sharing_share_password_attempts.window_started_at_ms <= ${now - windowMs} THEN ${now} ELSE sharing_share_password_attempts.window_started_at_ms END
        RETURNING attempts
      `
    : await sql`
        INSERT INTO sharing_vault_attempts (owner_sub, ip_digest, window_started_at_ms, attempts)
        VALUES (${ownerId}, ${ipDigest}, ${now}, 1)
        ON CONFLICT (owner_sub, ip_digest) DO UPDATE SET
          attempts = CASE WHEN sharing_vault_attempts.window_started_at_ms <= ${now - windowMs} THEN 1 ELSE sharing_vault_attempts.attempts + 1 END,
          window_started_at_ms = CASE WHEN sharing_vault_attempts.window_started_at_ms <= ${now - windowMs} THEN ${now} ELSE sharing_vault_attempts.window_started_at_ms END
        RETURNING attempts
      `;
  const attempts = Number(rows[0]?.attempts ?? 1);
  if (attempts > maxAttempts) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Wait a little before trying again.');
}

function sameSecret(received: string | undefined, expected: string) {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Health check is intentionally small and reveals no configuration or account data.
api.get('/api/v1/health', async (c) => {
  const sql = getDb();
  await sql`SELECT 1 AS ok`;
  return c.json({ ok: true });
});

api.get('/api/v1/me', (c) => {
  const user = userFrom(c);
  return c.json({ user: { googleSub: user.googleSub, email: user.email, displayName: user.displayName, pictureUrl: user.pictureUrl } });
});

// Projects owned by the authenticated Google account.
api.get('/api/v1/projects', async (c) => {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id AS project_id, p.name AS project_name, p.privacy, p.share_token,
      p.created_at_ms AS project_created_at, p.updated_at_ms AS project_updated_at,
      p.expires_at_ms, p.views, p.downloads, u.display_name AS owner_label,
      f.id AS file_id, f.name AS file_name, f.relative_path, f.content_type AS file_type,
      f.size_bytes AS file_size, f.created_at_ms AS file_created_at,
      f.download_count AS file_download_count, f.status AS file_status
    FROM sharing_projects p
    JOIN sharing_users u ON u.google_sub = p.owner_sub
    LEFT JOIN sharing_project_files f ON f.project_id = p.id
    WHERE p.owner_sub = ${userFrom(c).googleSub}
    ORDER BY p.updated_at_ms DESC, f.created_at_ms ASC
  `;
  return c.json({ projects: foldProjectRows(rows as Record<string, unknown>[]) });
});

api.post('/api/v1/projects', async (c) => {
  const body = await readJson(c);
  const user = userFrom(c);
  const name = requireText(body.name, 'Project name', 120);
  const privacyValue = body.privacy ?? 'open';
  if (!['open', 'password', 'private'].includes(String(privacyValue))) throw new ApiError(400, 'INVALID_INPUT', 'Privacy must be open, password, or private.');
  const privacy = privacyValue as ProjectView['privacy'];
  const expiresAt = parseExpiresAt(body.expiresAt);
  let passwordHash: string | null = null;
  if (privacy === 'password') passwordHash = await hashPassphrase(requireText(body.password, 'Share password', 256, 8));
  const id = randomUUID();
  const shareToken = privacy === 'private' ? null : randomShareToken();
  const now = currentTimeMs();
  const sql = getDb();
  await sql`
    INSERT INTO sharing_projects (id, owner_sub, name, privacy, share_token, share_password_hash, expires_at_ms, created_at_ms, updated_at_ms)
    VALUES (${id}, ${user.googleSub}, ${name}, ${privacy}, ${shareToken}, ${passwordHash}, ${expiresAt}, ${now}, ${now})
  `;
  return c.json({ project: await getOwnedProjectView(sql, user.googleSub, id) }, 201);
});

api.get('/api/v1/projects/:id', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const project = await getOwnedProjectView(getDb(), userFrom(c).googleSub, projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project was not found.');
  return c.json({ project });
});

api.patch('/api/v1/projects/:id', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const user = userFrom(c);
  const body = await readJson(c);
  const sql = getDb();
  const current = await getOwnedProject(sql, user.googleSub, projectId);
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Project was not found.');
  const name = body.name === undefined ? String(current.name) : requireText(body.name, 'Project name', 120);
  const privacyInput = body.privacy === undefined ? String(current.privacy) : String(body.privacy);
  if (!['open', 'password', 'private'].includes(privacyInput)) throw new ApiError(400, 'INVALID_INPUT', 'Privacy must be open, password, or private.');
  const privacy = privacyInput as ProjectView['privacy'];
  const shareToken = privacy === 'private' ? null : (typeof current.share_token === 'string' ? current.share_token : randomShareToken());
  let passwordHash = typeof current.share_password_hash === 'string' ? current.share_password_hash : null;
  if (privacy !== 'password') passwordHash = null;
  else if (body.password !== undefined && body.password !== '') passwordHash = await hashPassphrase(requireText(body.password, 'Share password', 256, 8));
  else if (!passwordHash) throw new ApiError(400, 'PASSWORD_REQUIRED', 'Set a password before enabling password-protected sharing.');
  const hasExpiry = Object.prototype.hasOwnProperty.call(body, 'expiresAt');
  const expiresAt = hasExpiry
    ? parseExpiresAt(body.expiresAt)
    : current.expires_at_ms === null ? null : Number(current.expires_at_ms);
  const now = currentTimeMs();
  await sql`
    UPDATE sharing_projects SET name = ${name}, privacy = ${privacy}, share_token = ${shareToken},
      share_password_hash = ${passwordHash}, expires_at_ms = ${expiresAt}, updated_at_ms = ${now}
    WHERE id = ${projectId} AND owner_sub = ${user.googleSub}
  `;
  return c.json({ project: await getOwnedProjectView(sql, user.googleSub, projectId) });
});

api.delete('/api/v1/projects/:id', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const user = userFrom(c);
  const sql = getDb();
  const project = await getOwnedProject(sql, user.googleSub, projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project was not found.');
  const fileRows = await sql`SELECT blob_path FROM sharing_project_files WHERE project_id = ${projectId}`;
  const intentRows = await sql`SELECT blob_path FROM sharing_upload_intents WHERE project_id = ${projectId}`;
  const paths = [...fileRows, ...intentRows].map((row) => String(row.blob_path));
  if (paths.length) await del(paths, blobCredentials());
  await sql`DELETE FROM sharing_projects WHERE id = ${projectId} AND owner_sub = ${user.googleSub}`;
  return c.json({ deleted: true });
});

api.post('/api/v1/projects/:id/upload-intents', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const user = userFrom(c);
  const body = await readJson(c);
  const name = cleanFileName(requireText(body.name, 'File name', 255));
  const size = Number(body.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new ApiError(400, 'INVALID_INPUT', 'File size must be a non-negative whole number.');
  const contentType = safeContentType(body.type);
  const relativePath = cleanRelativePath(body.relativePath, name);
  const sql = getDb();
  const project = await getOwnedProject(sql, user.googleSub, projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project was not found.');
  if (projectIsExpired(project)) throw new ApiError(409, 'PROJECT_EXPIRED', 'Extend the project expiration before uploading more files.');
  const intentId = randomUUID();
  const blobPath = `users/${userPathKey(user.googleSub)}/projects/${projectId}/${intentId}-${name}`;
  await sql`
    INSERT INTO sharing_upload_intents (id, owner_sub, project_id, blob_path, name, relative_path, content_type, expected_size, created_at_ms)
    VALUES (${intentId}, ${user.googleSub}, ${projectId}, ${blobPath}, ${name}, ${relativePath}, ${contentType}, ${size}, ${currentTimeMs()})
  `;
  return c.json({ intentId, pathname: blobPath, handleUploadUrl: '/api/v1/blob/upload-handler' }, 201);
});

api.get('/api/v1/projects/:id/files/:fileId/download', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const fileId = validateUuid(c.req.param('fileId'), 'File');
  const user = userFrom(c);
  const sql = getDb();
  const rows = await sql`
    SELECT f.id, f.name, f.content_type, f.size_bytes, f.blob_path, f.status
    FROM sharing_project_files f JOIN sharing_projects p ON p.id = f.project_id
    WHERE p.id = ${projectId} AND p.owner_sub = ${user.googleSub} AND f.id = ${fileId} AND f.status = 'ready'
    LIMIT 1
  `;
  const file = rows[0];
  if (!file) throw new ApiError(404, 'FILE_NOT_FOUND', 'File was not found or is no longer available.');
  await sql`UPDATE sharing_project_files SET download_count = download_count + 1 WHERE id = ${fileId}`;
  await sql`UPDATE sharing_projects SET downloads = downloads + 1, updated_at_ms = ${currentTimeMs()} WHERE id = ${projectId}`;
  return streamBlob(String(file.blob_path), String(file.name), String(file.content_type), Number(file.size_bytes));
});

api.post('/api/v1/projects/:id/rotate-share-link', async (c) => {
  const projectId = validateUuid(c.req.param('id'), 'Project');
  const user = userFrom(c);
  const sql = getDb();
  const project = await getOwnedProject(sql, user.googleSub, projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project was not found.');
  if (project.privacy === 'private') throw new ApiError(409, 'PRIVATE_PROJECT', 'Private projects do not have share links.');
  const token = randomShareToken();
  await sql`UPDATE sharing_projects SET share_token = ${token}, updated_at_ms = ${currentTimeMs()} WHERE id = ${projectId} AND owner_sub = ${user.googleSub}`;
  return c.json({ token });
});

// Password-protected links return no project or file metadata until the password is verified.
api.get('/api/v1/public/shares/:token', async (c) => {
  const token = c.req.param('token');
  if (token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  const sql = getDb();
  const project = await lookupShare(sql, token);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  if (projectIsExpired(project)) throw new ApiError(410, 'SHARE_EXPIRED', 'This share has expired.');
  const access = c.req.header('x-share-access') || '';
  if (project.privacy === 'password' && !verifyScopedToken(access, 'share-password', String(project.id))) {
    return c.json({ requiresPassword: true });
  }
  await sql`UPDATE sharing_projects SET views = views + 1 WHERE id = ${project.id}`;
  const rows = await publicProjectQuery(sql, token);
  const projects = foldProjectRows(rows as Record<string, unknown>[]);
  const { ownerLabel: _privateOwnerLabel, ...publicProject } = projects[0];
  return c.json({ requiresPassword: false, project: publicProject });
});

api.post('/api/v1/public/shares/:token/unlock', async (c) => {
  const token = c.req.param('token');
  if (token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  const body = await readJson(c);
  const passphrase = requireText(body.password, 'Password', 256, 1);
  const sql = getDb();
  const project = await lookupShare(sql, token);
  if (!project || project.privacy !== 'password') throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  if (projectIsExpired(project)) throw new ApiError(410, 'SHARE_EXPIRED', 'This share has expired.');
  const digest = hashIpAddress(requestIp(c), rateLimitPepper());
  await recordRateLimitAttempt(sql, 'sharing_share_password_attempts', String(project.id), digest, currentTimeMs(), 8);
  const storedHash = String(project.share_password_hash || '');
  if (!storedHash || !(await verifyPassphrase(passphrase, storedHash))) {
    throw new ApiError(401, 'INVALID_PASSWORD', 'The password is incorrect.');
  }
  await sql`UPDATE sharing_share_password_attempts SET attempts = 0, window_started_at_ms = ${currentTimeMs()} WHERE project_id = ${project.id} AND ip_digest = ${digest}`;
  return c.json({ accessToken: issueScopedToken(String(project.id), 'share-password', 5 * 60) });
});

api.get('/api/v1/public/shares/:token/files/:fileId/download', async (c) => {
  const token = c.req.param('token');
  const fileId = validateUuid(c.req.param('fileId'), 'File');
  if (token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  const sql = getDb();
  const project = await lookupShare(sql, token);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  if (projectIsExpired(project)) throw new ApiError(410, 'SHARE_EXPIRED', 'This share has expired.');
  if (project.privacy === 'password' && !verifyScopedToken(c.req.header('x-share-access') || '', 'share-password', String(project.id))) {
    throw new ApiError(401, 'PASSWORD_REQUIRED', 'Unlock this share before downloading files.');
  }
  const rows = await sql`
    SELECT f.name, f.content_type, f.size_bytes, f.blob_path
    FROM sharing_project_files f
    WHERE f.project_id = ${project.id} AND f.id = ${fileId} AND f.status = 'ready'
    LIMIT 1
  `;
  const file = rows[0];
  if (!file) throw new ApiError(404, 'FILE_NOT_FOUND', 'File was not found or is no longer available.');
  await sql`UPDATE sharing_project_files SET download_count = download_count + 1 WHERE id = ${fileId}`;
  await sql`UPDATE sharing_projects SET downloads = downloads + 1 WHERE id = ${project.id}`;
  return streamBlob(String(file.blob_path), String(file.name), String(file.content_type), Number(file.size_bytes));
});

api.get('/api/v1/shared', async (c) => {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id AS project_id, p.name AS project_name, p.privacy, p.share_token,
      p.created_at_ms AS project_created_at, p.updated_at_ms AS project_updated_at,
      p.expires_at_ms, p.views, p.downloads, u.display_name AS owner_label,
      f.id AS file_id, f.name AS file_name, f.relative_path, f.content_type AS file_type,
      f.size_bytes AS file_size, f.created_at_ms AS file_created_at,
      f.download_count AS file_download_count, f.status AS file_status
    FROM sharing_projects p
    JOIN sharing_users u ON u.google_sub = p.owner_sub
    JOIN sharing_saved_projects saved ON saved.project_id = p.id
    LEFT JOIN sharing_project_files f ON f.project_id = p.id
    WHERE saved.owner_sub = ${userFrom(c).googleSub} AND p.privacy = 'open'
      AND (p.expires_at_ms IS NULL OR p.expires_at_ms > ${currentTimeMs()})
    ORDER BY saved.saved_at_ms DESC, f.created_at_ms ASC
  `;
  return c.json({ projects: foldProjectRows(rows as Record<string, unknown>[]) });
});

api.post('/api/v1/shared/:token', async (c) => {
  const token = c.req.param('token');
  const sql = getDb();
  const project = await lookupShare(sql, token);
  if (!project || projectIsExpired(project)) throw new ApiError(404, 'NOT_FOUND', 'Share was not found.');
  if (project.privacy === 'password') throw new ApiError(403, 'PASSWORD_REQUIRED', 'Unlock this password-protected share directly before accessing it.');
  if (project.owner_sub === userFrom(c).googleSub) throw new ApiError(409, 'OWN_PROJECT', 'You already own this project.');
  await sql`
    INSERT INTO sharing_saved_projects (owner_sub, project_id, saved_at_ms)
    VALUES (${userFrom(c).googleSub}, ${project.id}, ${currentTimeMs()})
    ON CONFLICT (owner_sub, project_id) DO NOTHING
  `;
  return c.json({ saved: true });
});

api.delete('/api/v1/shared/:token', async (c) => {
  const token = c.req.param('token');
  await getDb()`
    DELETE FROM sharing_saved_projects saved
    USING sharing_projects p
    WHERE saved.project_id = p.id AND saved.owner_sub = ${userFrom(c).googleSub} AND p.share_token = ${token}
  `;
  return c.json({ removed: true });
});

// Presigned private Blob uploads. Google auth is checked for token generation;
// completion callbacks are separately verified by Vercel Blob's webhook signature.
api.post('/api/v1/blob/upload-handler', async (c) => {
  const body = c.get('presignedBody');
  assertPresignedUploadConfigured();
  const sql = getDb();
  const result = await handleUploadPresigned({
    body,
    request: c.req.raw,
    webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY,
    getSignedToken: async (pathname, clientPayload) => {
      const user = userFrom(c);
      if (!clientPayload || !UUID_RE.test(clientPayload)) throw new ApiError(403, 'UPLOAD_NOT_AUTHORIZED', 'This upload was not authorized.');
      const projectIntents = await sql`
        SELECT i.id, i.blob_path, i.expected_size, i.content_type
        FROM sharing_upload_intents i JOIN sharing_projects p ON p.id = i.project_id
        WHERE i.id = ${clientPayload} AND i.owner_sub = ${user.googleSub} AND i.blob_path = ${pathname}
        LIMIT 1
      `;
      const vaultIntents = projectIntents.length ? [] : await sql`
        SELECT id, blob_path, expected_size, content_type
        FROM sharing_vault_upload_intents
        WHERE id = ${clientPayload} AND owner_sub = ${user.googleSub} AND blob_path = ${pathname}
        LIMIT 1
      `;
      const intent = projectIntents[0] || vaultIntents[0];
      if (!intent) throw new ApiError(403, 'UPLOAD_NOT_AUTHORIZED', 'This upload was not authorized.');
      const expectedSize = Number(intent.expected_size);
      const allowedContentTypes = [String(intent.content_type || 'application/octet-stream')];
      const validUntil = currentTimeMs() + 15 * 60 * 1000;
      const token = await issueSignedToken({
        pathname,
        operations: ['put'],
        maximumSizeInBytes: Math.max(expectedSize, 1),
        allowedContentTypes,
        validUntil,
        ...(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID
          ? { oidcToken: process.env.VERCEL_OIDC_TOKEN, storeId: process.env.BLOB_STORE_ID }
          : process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
      });
      return {
        token,
        urlOptions: {
          maximumSizeInBytes: Math.max(expectedSize, 1),
          allowedContentTypes,
          validUntil,
          allowOverwrite: false,
          addRandomSuffix: false,
        },
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const intentId = typeof tokenPayload === 'string' ? tokenPayload : '';
      const projectIntents = intentId ? await sql`
        SELECT i.id, i.owner_sub, i.project_id, i.name, i.relative_path, i.content_type, i.expected_size, i.blob_path
        FROM sharing_upload_intents i WHERE i.id = ${intentId} AND i.blob_path = ${blob.pathname} LIMIT 1
      ` : [];
      const vaultIntents = projectIntents.length || !intentId ? [] : await sql`
        SELECT id, owner_sub, name, content_type, expected_size, blob_path
        FROM sharing_vault_upload_intents WHERE id = ${intentId} AND blob_path = ${blob.pathname} LIMIT 1
      `;
      const intent = projectIntents[0] || vaultIntents[0];
      if (!intent) {
        const existingProjectFile = intentId ? await sql`SELECT id FROM sharing_project_files WHERE id = ${intentId} AND blob_path = ${blob.pathname} LIMIT 1` : [];
        const existingVaultFile = intentId ? await sql`SELECT id FROM sharing_vault_files WHERE id = ${intentId} AND blob_path = ${blob.pathname} LIMIT 1` : [];
        if (existingProjectFile.length || existingVaultFile.length) return;
        throw new ApiError(400, 'UPLOAD_INTENT_NOT_FOUND', 'The upload intent was not found.');
      }
      const storedBlob = await head(blob.pathname, blobCredentials());
      if (Number(intent.expected_size) !== Number(storedBlob.size)) throw new ApiError(400, 'UPLOAD_SIZE_MISMATCH', 'Uploaded file size did not match its authorized size.');
      const createdAt = currentTimeMs();
      if (projectIntents.length) {
        await sql`
          INSERT INTO sharing_project_files (id, project_id, name, relative_path, content_type, size_bytes, blob_path, status, created_at_ms)
          VALUES (${intent.id}, ${intent.project_id}, ${intent.name}, ${intent.relative_path}, ${intent.content_type || storedBlob.contentType}, ${storedBlob.size}, ${intent.blob_path}, 'ready', ${createdAt})
          ON CONFLICT (id) DO NOTHING
        `;
        await sql`DELETE FROM sharing_upload_intents WHERE id = ${intent.id}`;
        await sql`UPDATE sharing_projects SET updated_at_ms = ${createdAt} WHERE id = ${intent.project_id}`;
      } else {
        await sql`
          INSERT INTO sharing_vault_files (id, owner_sub, name, content_type, size_bytes, blob_path, added_at_ms)
          VALUES (${intent.id}, ${intent.owner_sub}, ${intent.name}, ${intent.content_type || storedBlob.contentType}, ${storedBlob.size}, ${intent.blob_path}, ${createdAt})
          ON CONFLICT (id) DO NOTHING
        `;
        await sql`DELETE FROM sharing_vault_upload_intents WHERE id = ${intent.id}`;
      }
    },
  });
  return c.json(result);
});

// Vault metadata and file routes are separate from shareable projects.
api.get('/api/v1/vault/status', async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT owner_sub FROM sharing_vault_settings WHERE owner_sub = ${userFrom(c).googleSub} LIMIT 1`;
  return c.json({ configured: Boolean(rows.length) });
});

api.post('/api/v1/vault/setup', async (c) => {
  const user = userFrom(c);
  const body = await readJson(c);
  const passphrase = requireText(body.passphrase, 'Vault passphrase', 256, 8);
  const sql = getDb();
  const now = currentTimeMs();
  const passphraseHash = await hashPassphrase(passphrase);
  const rows = await sql`
    INSERT INTO sharing_vault_settings (owner_sub, passphrase_hash, created_at_ms, updated_at_ms)
    VALUES (${user.googleSub}, ${passphraseHash}, ${now}, ${now})
    ON CONFLICT (owner_sub) DO NOTHING
    RETURNING owner_sub
  `;
  if (!rows.length) throw new ApiError(409, 'VAULT_ALREADY_CONFIGURED', 'The Vault has already been set up. Unlock it with its current passphrase.');
  return c.json({ accessToken: issueScopedToken(user.googleSub, 'vault', 10 * 60), expiresInSeconds: 600 }, 201);
});

api.post('/api/v1/vault/unlock', async (c) => {
  const user = userFrom(c);
  const body = await readJson(c);
  const passphrase = requireText(body.passphrase, 'Vault passphrase', 256, 1);
  const sql = getDb();
  const rows = await sql`SELECT passphrase_hash FROM sharing_vault_settings WHERE owner_sub = ${user.googleSub} LIMIT 1`;
  const storedHash = rows[0]?.passphrase_hash;
  if (!storedHash) throw new ApiError(409, 'VAULT_NOT_CONFIGURED', 'Set up the Vault before unlocking it.');
  const digest = hashIpAddress(requestIp(c), rateLimitPepper());
  await recordRateLimitAttempt(sql, 'sharing_vault_attempts', user.googleSub, digest, currentTimeMs(), 8);
  if (!(await verifyPassphrase(passphrase, String(storedHash)))) throw new ApiError(401, 'INVALID_PASSPHRASE', 'The Vault passphrase is incorrect.');
  await sql`UPDATE sharing_vault_attempts SET attempts = 0, window_started_at_ms = ${currentTimeMs()} WHERE owner_sub = ${user.googleSub} AND ip_digest = ${digest}`;
  return c.json({ accessToken: issueScopedToken(user.googleSub, 'vault', 10 * 60), expiresInSeconds: 600 });
});

api.put('/api/v1/vault/passphrase', async (c) => {
  const user = userFrom(c);
  const body = await readJson(c);
  const currentPassphrase = requireText(body.currentPassphrase, 'Current passphrase', 256, 1);
  const newPassphrase = requireText(body.newPassphrase, 'New passphrase', 256, 8);
  const sql = getDb();
  const rows = await sql`SELECT passphrase_hash FROM sharing_vault_settings WHERE owner_sub = ${user.googleSub} LIMIT 1`;
  const storedHash = rows[0]?.passphrase_hash;
  if (!storedHash) throw new ApiError(409, 'VAULT_NOT_CONFIGURED', 'Set up the Vault before changing its passphrase.');
  const digest = hashIpAddress(requestIp(c), rateLimitPepper());
  await recordRateLimitAttempt(sql, 'sharing_vault_attempts', user.googleSub, digest, currentTimeMs(), 8);
  if (!(await verifyPassphrase(currentPassphrase, String(storedHash)))) throw new ApiError(401, 'INVALID_PASSPHRASE', 'The current Vault passphrase is incorrect.');
  await sql`UPDATE sharing_vault_settings SET passphrase_hash = ${await hashPassphrase(newPassphrase)}, updated_at_ms = ${currentTimeMs()} WHERE owner_sub = ${user.googleSub}`;
  await sql`UPDATE sharing_vault_attempts SET attempts = 0, window_started_at_ms = ${currentTimeMs()} WHERE owner_sub = ${user.googleSub} AND ip_digest = ${digest}`;
  return c.json({ accessToken: issueScopedToken(user.googleSub, 'vault', 10 * 60), expiresInSeconds: 600 });
});

function requireVaultAccess(c: { req: { header: (name: string) => string | undefined } }, ownerSub: string) {
  const token = c.req.header('x-vault-access') || '';
  if (!verifyScopedToken(token, 'vault', ownerSub)) throw new ApiError(423, 'VAULT_LOCKED', 'Unlock the Vault to continue.');
}

api.get('/api/v1/vault/files', async (c) => {
  const user = userFrom(c);
  requireVaultAccess(c, user.googleSub);
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, content_type, size_bytes, added_at_ms
    FROM sharing_vault_files WHERE owner_sub = ${user.googleSub} ORDER BY added_at_ms DESC
  `;
  return c.json({ files: rows.map((row) => ({
    id: String(row.id), name: String(row.name), type: String(row.content_type), size: Number(row.size_bytes), addedAt: Number(row.added_at_ms),
  })) });
});

api.post('/api/v1/vault/upload-intents', async (c) => {
  const user = userFrom(c);
  requireVaultAccess(c, user.googleSub);
  const body = await readJson(c);
  const name = cleanFileName(requireText(body.name, 'File name', 255));
  const size = Number(body.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new ApiError(400, 'INVALID_INPUT', 'File size must be a non-negative whole number.');
  const contentType = safeContentType(body.type);
  const sql = getDb();
  const intentId = randomUUID();
  const blobPath = `users/${userPathKey(user.googleSub)}/vault/${intentId}-${name}`;
  await sql`
    INSERT INTO sharing_vault_upload_intents (id, owner_sub, blob_path, name, content_type, expected_size, created_at_ms)
    VALUES (${intentId}, ${user.googleSub}, ${blobPath}, ${name}, ${contentType}, ${size}, ${currentTimeMs()})
  `;
  return c.json({ intentId, pathname: blobPath, handleUploadUrl: '/api/v1/blob/upload-handler' }, 201);
});

api.get('/api/v1/vault/files/:id/download', async (c) => {
  const user = userFrom(c);
  requireVaultAccess(c, user.googleSub);
  const fileId = validateUuid(c.req.param('id'), 'File');
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, content_type, size_bytes, blob_path
    FROM sharing_vault_files WHERE id = ${fileId} AND owner_sub = ${user.googleSub} LIMIT 1
  `;
  const file = rows[0];
  if (!file) throw new ApiError(404, 'FILE_NOT_FOUND', 'Vault file was not found.');
  return streamBlob(String(file.blob_path), String(file.name), String(file.content_type), Number(file.size_bytes));
});

api.delete('/api/v1/vault/files/:id', async (c) => {
  const user = userFrom(c);
  requireVaultAccess(c, user.googleSub);
  const fileId = validateUuid(c.req.param('id'), 'File');
  const sql = getDb();
  const rows = await sql`SELECT blob_path FROM sharing_vault_files WHERE id = ${fileId} AND owner_sub = ${user.googleSub} LIMIT 1`;
  if (!rows[0]) throw new ApiError(404, 'FILE_NOT_FOUND', 'Vault file was not found.');
  await del(String(rows[0].blob_path), blobCredentials());
  await sql`DELETE FROM sharing_vault_files WHERE id = ${fileId} AND owner_sub = ${user.googleSub}`;
  return c.json({ deleted: true });
});

api.get('/api/v1/cron/expire', async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, 'CRON_NOT_CONFIGURED', 'Cron authentication is not configured.');
  if (!sameSecret(c.req.header('authorization')?.replace(/^Bearer\s+/i, ''), secret)) throw new ApiError(401, 'CRON_UNAUTHORIZED', 'Unauthorized.');
  const result = await runExpirationCleanup();
  return c.json({ ok: true, ...result });
});

export default api;
