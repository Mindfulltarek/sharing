# Sharing — browser workspace and Vercel API

Sharing is a responsive React/Vite file-sharing interface with a marketing page, project workspace, share pages, QR/ZIP flows, and a separate Vault. Google Identity Services sign-in is implemented on `/login`; the returned ID token is sent to `/api/v1/me` for server-side verification. **Sign-in verifies an account, but the current project and Vault UI still use browser-local services; it does not yet upload or sync workspace data to cloud storage.** The browser workspace remains available without an account or credentials.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Use the URL printed by Vite/Nitro (normally `http://localhost:3000`). `/` and `/welcome` show the landing page; `/login` offers Google sign-in when `VITE_GOOGLE_CLIENT_ID` is configured, plus **Continue without account**. `/app` remains directly accessible without credentials. `/share/:token` resolves against local browser data only.

The local browser workspace needs no environment variables. Without a Google client ID, the Google button explains which settings are missing; sign-in-free access still works. Copy `.env.example` to `.env.local` only when configuring Google and/or the backend. Never put secrets in a `VITE_` variable; the Google client ID is public, but database credentials and API secrets are not.

## Vercel build and deployment

The Vite config installs Nitro's Vite plugin and targets Vercel. `npm run build` produces Vercel's Build Output API under `.vercel/output`; do not override the output directory to `dist` in project settings. The setup follows [Nitro's Vite integration](https://vercel.com/docs/frameworks/full-stack/vite-with-nitro) and [filesystem routing](https://nitro.build/docs/routing).

1. Import the repository into Vercel and use `npm run build` as the build command. The Nitro plugin selects the Vercel Node.js runtime.
2. Configure the Google Auth Platform consent/branding screen, then create an OAuth **Web application** client. If the app is in Testing mode, add your Google account as a test user. Add the deployed website origin (and any local development origin you use) under Authorized JavaScript origins. This implementation uses the Google Identity Services popup flow; it does not need a redirect URI.
3. Create a Neon Postgres database and a **private** Vercel Blob store. Keep the Blob store private; browser clients must never receive a read/write store token.
4. Add these variables in Vercel Project Settings. The `VITE_` value is embedded at build time, so redeploy after changing it. Apply values to Production and any Preview environments you intend to enable:
   - `VITE_GOOGLE_CLIENT_ID` — the public Web client ID used by the sign-in button.
   - `GOOGLE_CLIENT_ID` — the **same** client ID, used by the server as the ID-token audience.
   - `DATABASE_URL` — Neon connection string; account verification upserts the user record here.
   - `ACCESS_TOKEN_SECRET`, `SHARE_RATE_LIMIT_PEPPER`, and `CRON_SECRET` — independent random secrets, each at least 32 bytes. Generate with `openssl rand -base64 48` and use a different value for each.
   - `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` — the private Blob store identifier and its signed-upload callback verification key.
   - Vercel OIDC must be available to the deployed function for private Blob operations. `BLOB_READ_WRITE_TOKEN` is supported for local development or where OIDC is not used; never expose it to browser code.
5. Apply the database migration once, using a trusted terminal with `DATABASE_URL` set (or pulled into `.env.local`):

   ```bash
   npm run db:migrate
   ```

6. Deploy. The API health endpoint is `GET /api/v1/health`; it returns 200 only after the database is configured and reachable. A 503 before `DATABASE_URL` and the schema are ready is expected.

Google sign-in succeeds only when the OAuth client is configured for the actual website origin, both client ID values match, the server can verify Google's keys, and `DATABASE_URL` plus the account table are ready. Vercel environment changes require a new deployment.

This workspace has no real Google client ID, Neon database, or Blob credentials. The build and local API behavior were checked, but a real Google sign-in, production migration, and private Blob upload/download still need to be verified with your project credentials.

## Authentication boundary

The Google button uses Google Identity Services to obtain an ID token; it is not a simulated button. The browser sends that token to `GET /api/v1/me`. The server verifies its signature against Google's published keys, checks issuer, audience, expiry, and verified email, then creates or updates the account row. It never trusts a client-supplied user ID. The token stays in JavaScript memory only; there is no persistent browser session, and a page reload requires signing in again.

The ID token is held in memory for authenticated API calls. However, the current Workspace UI has not been switched to `cloudApi`: projects, Vault metadata, sample data, and share links are still managed by local browser services. **A successful Google sign-in does not mean project upload, cloud sync, or cloud Vault storage is active.** Continuing without an account clears the in-memory Google token and opens the same local workspace.

## Backend included

- `server/api.ts` — Hono routes served through Nitro's Vite plugin under `/api/v1`.
- `migrations/0001_initial.sql` and `scripts/migrate.mjs` — Postgres schema and idempotent migration command.
- `server/auth.ts` — Google ID-token verification and account upsert.
- `server/security.ts` — scrypt passphrase verifiers, purpose-scoped short-lived tokens, high-entropy share tokens, and keyed IP digests for rate limits.
- [`@vercel/blob` private storage](https://vercel.com/docs/vercel-blob/private-storage) — short-lived, path-scoped presigned uploads; server-side completion callback verification; authenticated streaming downloads and deletion.
- `src/services/cloudApi.ts` — browser API client for project, shared-link, upload/download, and separate Vault calls. The login flow currently calls only `/api/v1/me`; workspace actions are not yet wired to these cloud methods.

Implemented API surface:

- `GET /api/v1/me`, `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:id`, link rotation, per-file upload intents and owner downloads.
- Public share lookup, password unlock, and file downloads under `/api/v1/public/shares/:token`. Password-protected shares disclose no project/file metadata before successful verification. Share passwords are never returned to the browser.
- `GET /api/v1/shared`, save/remove open shares. Password-protected links are not saved to this metadata list; open them directly so password-gated metadata cannot leak.
- Separate Vault setup/unlock/passphrase-change/list/upload/download/delete routes. Vault items are not included in project, share, or public-link queries.
- A protected expiration cleanup route at `GET /api/v1/cron/expire`.

### Expiration and cleanup schedule

Nitro's [scheduled-task configuration](https://nitro.build/docs/tasks) in `vite.config.ts` sets cleanup to **`0 3 * * *` (03:00 UTC daily)** and the production build emits the cron route at `/_vercel/cron`. This once-daily schedule is compatible with Vercel Hobby's daily cron limit; Hobby may invoke it at any point in the scheduled hour ([Vercel schedule limits](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). Nitro's cron handler validates Vercel's `Authorization: Bearer <CRON_SECRET>` header when the secret is configured, and the cleanup task fails closed if the secret is missing or shorter than 32 bytes. An authenticated manual cleanup endpoint is also available at `GET /api/v1/cron/expire`.

Expiration is enforced synchronously by public-share and public-download API reads, so a link stops working at its expiry timestamp even if scheduled cleanup has not run. Physical Blob deletion is asynchronous and batch-limited (up to 200 expired files/intents per run); large backlogs or provider errors may take additional runs. The cron is not a promise of exact-time physical erasure. Vercel invokes configured cron jobs only on production deployments, not preview deployments.

### Vault boundary

Vault files live in separate database tables and private Blob paths, and Vault endpoints require both the signed-in account and a short-lived, separate Vault unlock token. Passphrases are stored as scrypt verifiers. **File contents are not client-side encrypted by this implementation.** The Vault is not zero-knowledge or end-to-end encrypted; do not market it as production-grade encryption or use it as a substitute for an independently reviewed encrypted-storage design.

## Local backend environment

Copy the template and fill in values only when you have the corresponding services configured:

```bash
cp .env.example .env.local
```

`.env.local` is ignored by Git. Use a private Blob store. For local Blob operations, set `BLOB_READ_WRITE_TOKEN`; local completion callbacks also need a reachable callback URL, so use Vercel's local deployment workflow or a deliberate public tunnel and set `VERCEL_BLOB_CALLBACK_URL` accordingly. The UI demo itself does not require these values.

## Local demo behavior and limits

- Demo projects, shared items, Vault metadata, and settings live in this browser's `localStorage`; clearing browser data removes them. Demo share URLs are not cross-device cloud links.
- User-selected file bytes in the demo stay in memory for the current session and are not stored in browser storage. Seeded sample files have local sample content.
- The demo's seeded `KYOTO7` passcode is for exercising the local flow only. The browser SHA-256 verifier is not used by the server API.
- Demo analytics are local/sample values; they do not describe real recipients. Demo expiration and deletion do not remove cloud objects because the local demo does not upload them.
- Browser file/folder pickers can access only items the user explicitly chooses. Full file-manager access requires a native app and platform permissions.

## Checks

```bash
npm run typecheck
npm run typecheck:api
npm test
npm run build
npm audit --omit=dev
```

The automated tests cover password hashing, scoped tokens, expiry checks, file-path cleanup, and keyed IP digests. They do not substitute for authenticated integration tests against your Neon database, Google OAuth client, or Vercel Blob store.

## Project structure

- `src/components/` — landing page, local demo workspace, share page, dialogs, Settings, and Vault.
- `src/services.ts`, `src/services/ports.ts`, `src/services/adapters.ts` — existing local demo services and adapter contracts.
- `src/services/cloudApi.ts` — cloud API client; the account-verification call is connected, while project/Vault UI actions still use local adapters.
- `src/types.ts` and `src/demoData.ts` — UI models and clearly local sample data.
- `server/` — Nitro route entry and Hono API, Google token verification, Postgres access, and security helpers.
- `migrations/` and `scripts/migrate.mjs` — database schema and migration runner.
