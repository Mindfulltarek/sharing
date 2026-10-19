import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './errors';
import { getDb } from './db';

export interface AuthenticatedUser {
  googleSub: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function authenticateGoogleRequest(request: Request): Promise<AuthenticatedUser> {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in with Google to continue.');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Google sign-in verification is not configured yet.');

  let payload;
  try {
    ({ payload } = await jwtVerify(match[1], GOOGLE_JWKS, {
      algorithms: ['RS256'],
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
      audience: clientId,
      maxTokenAge: '2h',
    }));
  } catch {
    throw new ApiError(401, 'INVALID_ID_TOKEN', 'The Google sign-in token is invalid or expired.');
  }

  const googleSub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!googleSub || !email || !emailVerified) {
    throw new ApiError(401, 'INVALID_ID_TOKEN', 'A verified Google account is required.');
  }
  const displayName = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim().slice(0, 160)
    : email.slice(0, 160);
  const pictureUrl = typeof payload.picture === 'string' && payload.picture.startsWith('https://')
    ? payload.picture.slice(0, 2048)
    : null;

  const sql = getDb();
  await sql`
    INSERT INTO sharing_users (google_sub, email, display_name, picture_url, created_at_ms, updated_at_ms)
    VALUES (${googleSub}, ${email.slice(0, 320)}, ${displayName}, ${pictureUrl}, ${Date.now()}, ${Date.now()})
    ON CONFLICT (google_sub) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      picture_url = EXCLUDED.picture_url,
      updated_at_ms = EXCLUDED.updated_at_ms
  `;

  return { googleSub, email: email.slice(0, 320), displayName, pictureUrl };
}
