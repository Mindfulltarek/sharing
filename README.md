# Sharing — local demo plus Vercel-ready API

Sharing is a responsive React/Vite file-sharing interface with a marketing page, a project workspace, local demo share pages, QR/ZIP flows, and a separate Vault. The browser demo remains available without login. A Nitro API, Neon Postgres schema, and private Vercel Blob integration are included as the production backend foundation; the current demo UI does **not** call that backend until Google sign-in and a cloud-mode UI connection are added.

## Run the demo locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Use the URL printed by Vite/Nitro (normally `http://localhost:3000`). `/` and `/welcome` show the landing page; `/login` offers a simulated Google button and **Continue in demo**; `/app` remains directly accessible without credentials. The existing `/share/:token` route resolves against local browser data only.

The demo needs no environment variables. Creating `.env.local` is optional unless you are setting up the backend; never put real secrets in a `VITE_` variable.

## Vercel build and deployment

The Vite config installs Nitro's Vite plugin and targets Vercel. `npm run build` produces Vercel's Build Output API under `.vercel/output`; do not override the output directory to `dist` in project settings. The setup follows [Nitro's Vite integration](https://vercel.com/docs/frameworks/full-stack/vite-with-nitro) and [filesystem routing](https://nitro.build/docs/routing).

1. Import the repository into Vercel and use `npm run build` as the build command. The Nitro plugin selects the Vercel Node.js runtime.
2. Create a Neon Postgres database and a **private** Vercel Blob store. Keep the Blob store private; browser clients must never receive a read/write store token.
3. Add these variables in Vercel Project Settings. Apply them to the Production environment and any Preview environments you actually want to enable:
   - `DATABASE_URL` — Neon connection string.
   - `GOOGLE_CLIENT_ID` — the Google OAuth client ID that will be used as the ID-token audience after you add the sign-in UI.
   - `ACCESS_TOKEN_SECRET`, `SHARE_RATE_LIMIT_PEPPER`, and `CRON_SECRET` — independent random secrets, each at least 32 bytes. Generate with `openssl rand -base64 48` and use a different value for each.
   - `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` — the private Blob store identifier and its signed-upload callback verification key.
   - Vercel OIDC must be available to the deployed function for private Blob operations. `BLOB_READ_WRITE_TOKEN` is supported for local development or where OIDC is not used; never expose it to browser code.
4. Apply the database migration once, using a trusted terminal with `DATABASE_URL` set (or pulled into `.env.local`):

   ```bash
   npm run db:migrate
   ```

5. Deploy. The API health endpoint is `GET /api/v1/health`; it returns 200 only after the database is configured and reachable. A 503 before `DATABASE_URL` and the schema are ready is expected.

Vercel credentials and a live database/storage project are not present in this workspace. The generated Vercel build and local route behavior were checked, but an actual deployment, Google token exchange, Neon migration, and private Blob upload/download still need to be verified with your own project credentials.

## Authentication boundary — Google sign-in is intentionally not added

The `/login` Google-looking action is still a labeled demo shortcut, not OAuth. Demo continuation remains one click and does not depend on Google, credentials, or backend setup.

Production API routes require a Google **ID token** in `Authorization: Bearer <id-token>`. The server verifies its signature against Google's published keys, checks the configured audience and verified email, and creates/updates the account row. It never trusts a client-supplied user ID. Until `GOOGLE_CLIENT_ID` is configured and you add the Google sign-in UI, the authenticated API returns a configuration/auth error rather than exposing project, file, or Vault data.

`src/services/cloudApi.ts` is the browser-side integration seam. After adding Google Identity Services, pass the returned ID token to `setGoogleIdToken(idToken)` and use `cloudApi` for the cloud API. The token and short-lived Vault/share access tokens are held in memory only, not `localStorage`. The present UI continues to use the local demo services; it has not been silently switched to cloud mode.

## Backend included

- `server/api.ts` — Hono routes served through Nitro's Vite plugin under `/api/v1`.
- `migrations/0001_initial.sql` and `scripts/migrate.mjs` — Postgres schema and idempotent migration command.
- `server/auth.ts` — Google ID-token verification and account upsert.
- `server/security.ts` — scrypt passphrase verifiers, purpose-scoped short-lived tokens, high-entropy share tokens, and keyed IP digests for rate limits.
- [`@vercel/blob` private storage](https://vercel.com/docs/vercel-blob/private-storage) — short-lived, path-scoped presigned uploads; server-side completion callback verification; authenticated streaming downloads and deletion.
- `src/services/cloudApi.ts` — future frontend adapter for project, shared-link, upload/download, and separate Vault calls.

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
- `src/services/cloudApi.ts` — cloud API client to connect after Google sign-in is added.
- `src/types.ts` and `src/demoData.ts` — UI models and clearly local sample data.
- `server/` — Nitro route entry and Hono API, Google token verification, Postgres access, and security helpers.
- `migrations/` and `scripts/migrate.mjs` — database schema and migration runner.
