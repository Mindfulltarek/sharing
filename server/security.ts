import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';
import { ApiError } from './errors';

const SCRYPT_OPTIONS: ScryptOptions = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_BYTES = 64;
const TOKEN_ISSUER = 'sharing-app';

function deriveKey(secret: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(secret, salt, SCRYPT_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassphrase(passphrase: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassphrase(passphrase: string, storedHash: string) {
  const [algorithm, saltPart, keyPart, extra] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltPart || !keyPart || extra !== undefined) return false;
  try {
    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(keyPart, 'base64url');
    if (salt.length !== 16 || expected.length !== SCRYPT_BYTES) return false;
    const actual = await deriveKey(passphrase, salt);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function hashIpAddress(address: string, pepper: string) {
  return createHmac('sha256', pepper).update(address).digest('hex');
}

export function randomShareToken() {
  return randomBytes(24).toString('base64url');
}

function tokenSecret() {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'ACCESS_TOKEN_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload: Record<string, unknown>, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const body = encodeJson({ iss: TOKEN_ISSUER, iat: now, exp: now + ttlSeconds, ...payload });
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', tokenSecret()).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function issueScopedToken(subject: string, purpose: 'share-password' | 'vault', ttlSeconds: number) {
  return sign({ sub: subject, purpose }, ttlSeconds);
}

export function verifyScopedToken(token: string, purpose: 'share-password' | 'vault', subject: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as Record<string, unknown>;
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (header.alg !== 'HS256' || payload.iss !== TOKEN_ISSUER || payload.purpose !== purpose || payload.sub !== subject) return false;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac('sha256', tokenSecret()).update(`${headerPart}.${payloadPart}`).digest();
    const provided = Buffer.from(signaturePart, 'base64url');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

export function userPathKey(googleSub: string) {
  return createHash('sha256').update(googleSub).digest('hex').slice(0, 32);
}

export function cleanFileName(value: string) {
  const cleaned = value
    .normalize('NFC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/^\.+$/, 'file')
    .trim();
  const result = cleaned.slice(0, 255);
  if (!result || result === '.' || result === '..') return 'file';
  return result;
}

export function cleanRelativePath(value: unknown, fileName: string) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map(cleanFileName);
  if (!parts.length) return fileName;
  parts[parts.length - 1] = fileName;
  return parts.join('/').slice(0, 1024);
}
