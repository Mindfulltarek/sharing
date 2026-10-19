import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
config({ path: '.env', override: false });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const sql = neon(connectionString);
const migrationName = '0001_initial.sql';
const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations', migrationName);
const source = await readFile(migrationPath, 'utf8');
const statements = source.split(';').map((statement) => statement.trim()).filter(Boolean);

await sql.query(`CREATE TABLE IF NOT EXISTS sharing_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at_ms BIGINT NOT NULL
)`);
const applied = await sql`SELECT name FROM sharing_schema_migrations WHERE name = ${migrationName} LIMIT 1`;
if (applied.length) {
  console.log(`${migrationName} is already applied.`);
  process.exit(0);
}

for (const statement of statements) await sql.query(statement);
await sql`INSERT INTO sharing_schema_migrations (name, applied_at_ms) VALUES (${migrationName}, ${Date.now()})`;
console.log(`Applied ${migrationName}.`);
