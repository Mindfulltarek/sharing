CREATE TABLE IF NOT EXISTS sharing_users (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sharing_projects (
  id UUID PRIMARY KEY,
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  privacy TEXT NOT NULL CHECK (privacy IN ('open', 'password', 'private')),
  share_token TEXT UNIQUE,
  share_password_hash TEXT,
  expires_at_ms BIGINT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  downloads BIGINT NOT NULL DEFAULT 0,
  CHECK ((privacy = 'private' AND share_token IS NULL) OR (privacy <> 'private' AND share_token IS NOT NULL)),
  CHECK ((privacy = 'password' AND share_password_hash IS NOT NULL) OR privacy <> 'password')
);
CREATE INDEX IF NOT EXISTS sharing_projects_owner_updated_idx ON sharing_projects(owner_sub, updated_at_ms DESC);
CREATE INDEX IF NOT EXISTS sharing_projects_expiry_idx ON sharing_projects(expires_at_ms) WHERE expires_at_ms IS NOT NULL;

CREATE TABLE IF NOT EXISTS sharing_project_files (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES sharing_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  relative_path TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  blob_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'expired')),
  created_at_ms BIGINT NOT NULL,
  download_count BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sharing_project_files_project_idx ON sharing_project_files(project_id, created_at_ms);

CREATE TABLE IF NOT EXISTS sharing_upload_intents (
  id UUID PRIMARY KEY,
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES sharing_projects(id) ON DELETE CASCADE,
  blob_path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  relative_path TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  expected_size BIGINT NOT NULL CHECK (expected_size >= 0),
  created_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sharing_upload_intents_created_idx ON sharing_upload_intents(created_at_ms);

CREATE TABLE IF NOT EXISTS sharing_saved_projects (
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES sharing_projects(id) ON DELETE CASCADE,
  saved_at_ms BIGINT NOT NULL,
  PRIMARY KEY (owner_sub, project_id)
);

CREATE TABLE IF NOT EXISTS sharing_vault_settings (
  owner_sub TEXT PRIMARY KEY REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  passphrase_hash TEXT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sharing_vault_upload_intents (
  id UUID PRIMARY KEY,
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  blob_path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  expected_size BIGINT NOT NULL CHECK (expected_size >= 0),
  created_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sharing_vault_upload_intents_created_idx ON sharing_vault_upload_intents(created_at_ms);

CREATE TABLE IF NOT EXISTS sharing_vault_files (
  id UUID PRIMARY KEY,
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  blob_path TEXT NOT NULL UNIQUE,
  added_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sharing_vault_files_owner_idx ON sharing_vault_files(owner_sub, added_at_ms DESC);

CREATE TABLE IF NOT EXISTS sharing_share_password_attempts (
  project_id UUID NOT NULL REFERENCES sharing_projects(id) ON DELETE CASCADE,
  ip_digest TEXT NOT NULL,
  window_started_at_ms BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, ip_digest)
);

CREATE TABLE IF NOT EXISTS sharing_vault_attempts (
  owner_sub TEXT NOT NULL REFERENCES sharing_users(google_sub) ON DELETE CASCADE,
  ip_digest TEXT NOT NULL,
  window_started_at_ms BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_sub, ip_digest)
);
