import { neon } from '@neondatabase/serverless';
import { ApiError } from './errors';

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'The database is not configured yet.');
  }
  return neon(connectionString);
}

export function currentTimeMs() {
  return Date.now();
}
