# Sharing — local workspace and cloud projects

Sharing is a responsive React/Vite file-sharing app with a sign-in-free local workspace, an optional Google-account Cloud workspace, public/password-protected share pages, downloads, and a separate Vault. Google Identity Services returns an ID token that the server verifies. After verification, `/cloud` uses the Cloud API to list account projects, create projects, upload files to the connected **Private** Vercel Blob store, and manage/download those projects. `/share/:token` first resolves a local browser share, then checks the public Cloud API when no local project matches.

The local workspace remains available without Google sign-in, OAuth credentials, or setup. Local projects are not copied or synchronized automatically. Vault remains separate and is not included in project uploads or shares.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm ci --legacy-peer-deps
npm run dev
```

Use the URL printed by Vite/Nitro (normally `http://localhost:3000`). Routes:

- `/` and `/welcome` — landing page.
- `/login` — Google sign-in plus **Continue without account**.
- `/app` — local browser workspace; no credentials required.
- `/cloud` — account-owned cloud projects; sign in with Google first. A page reload clears the in-memory token, so sign in again.
- `/share/:token` — local share when the token exists in this browser; otherwise the public Cloud API is checked. Public cloud links do not require the recipient to sign in. Password-protected cloud links require the separate project password.

Local-only use requires no environment variables. Copy `.env.example` to `.env.local` only when configuring Google and/or the backend. Never put secrets in a `VITE_` variable; the Google client ID is public, but database credentials and API secrets are not.

## Vercel build and deployment

The Vite config installs Nitro's Vite plugin and targets Vercel. `npm run build` produces Vercel's Build Output API under `.vercel/output`; do not override the output directory to `dist` in project settings. The setup follows [Nitro's Vite integration](https://vercel.com/docs/frameworks/full-stack/vite-with-nitro) and [filesystem routing](https://nitro.build/docs/routing).

1. Import the repository into Vercel and use `npm run build` as the build command. The Nitro plugin selects the Vercel Node.js runtime.
2. Configure Google Auth Platform and create an OAuth **Web application** client. If the app is in Testing mode, add your Google account as a test user. Add the deployed website origin (and any local development origin you use) under Authorized JavaScript origins. The implementation uses Google Identity Services popup flow; it does not need a redirect URI.
3. Create a Neon Postgres database and a **Private** Vercel Blob store. Keep the Blob store private; browser clients must never receive a read/write store token.
4. Add these variables in Vercel Project Settings. The `VITE_` value is embedded at build time, so redeploy after changing it. Apply values to Production and any Preview environments you intend to enable:
   - `VITE_GOOGLE_CLIENT_ID` — public Web client ID used by the sign-in button.
   - `GOOGLE_CLIENT_ID` — the **same** client ID, used by the server as the ID-token audience.
   - `DATABASE_URL` — Neon connection string.
   - `ACCESS_TOKEN_SECRET`, `SHARE_RATE_LIMIT_PEPPER`, and `CRON_SECRET` — independent random secrets, each at least 32 bytes. Generate with `openssl rand -base64 48` and use a different value for each.
   - `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` — private Blob store identifier and signed-upload callback verification key.
   - Vercel OIDC must be available to the deployed function for private Blob operations. `BLOB_READ_WRITE_TOKEN` is supported for local development or where OIDC is not used; never expose it to browser code.
5. Apply the database migration once, using a trusted terminal with `DATABASE_URL` set (or pulled into `.env.local`):

   ```bash
   npm run db:migrate
   ```

6. Deploy. `GET /api/v1/health` returns 200 only after the database is configured and reachable. Vercel environment changes require a new deployment.

A successful Google sign-in verifies the account and opens `/cloud`; it does not itself prove that database migrations, private Blob uploads, or downloads work. The cloud UI reports API failures rather than treating a local project as cloud-backed. To test a live deployment, sign in, create a **new cloud project**, upload a small file, copy its link, and open it in a separate browser/device. Existing local-browser projects and their links are not migrated automatically; select their original files again in the Cloud workspace.

## Authentication and storage boundaries

The browser sends the Google ID token to `GET /api/v1/me`. The server verifies its signature against Google's published keys, checks issuer, audience, expiry, and verified email, then creates or updates the account row. It never trusts a client-supplied user ID. The token stays in JavaScript memory only; a page reload requires signing in again.

`/cloud` uses the authenticated Cloud API for project listing, creation, file upload, owner downloads, link rotation, and deletion. File bytes are uploaded through Vercel's signed private-upload flow; they are not saved in `localStorage`. Metadata is stored server-side for account-owned cloud projects. Public and password-protected share pages use server endpoints for lookup, unlock, and file downloads. Password-protected share metadata is not shown before successful verification; share passwords are not returned to the browser.

`/app` is intentionally separate: local projects and Vault metadata are stored in browser storage, while user-selected file bytes remain in memory for the current session only. Local share links depend on that browser's data and are not cross-device links. The browser's file/folder picker can access only items explicitly chosen by the user; full file-manager access requires a native app and platform permissions.

The Vault is kept out of project lists, public shares, and upload forms. The current Vault UI remains local to the browser. The backend also contains separate Vault API routes, but they are not connected to the local Vault screen. **Vault file contents are not client-side encrypted by this implementation**; this is not production-grade or end-to-end encryption.

## Backend included

- `server/api.ts` — Hono routes served through Nitro under `/api/v1`.
- `migrations/0001_initial.sql` and `scripts/migrate.mjs` — Postgres schema and migration command.
- `server/auth.ts` — Google ID-token verification and account upsert.
- `server/security.ts` — scrypt passphrase verifiers, purpose-scoped short-lived tokens, high-entropy share tokens, and keyed IP digests for rate limits.
- `server/blob.ts` — private Blob credentials and signed-upload configuration checks.
- `src/services/cloudApi.ts` — browser API client for account projects, uploads/downloads, public shares, and separate Vault calls.
- `src/components/CloudWorkspace.tsx` and `src/components/CloudSharePage.tsx` — account project management and public cloud share/download flows.

Implemented API surface:

- `GET /api/v1/me`, `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:id`, link rotation, per-file upload intents, and owner downloads.
- Public share lookup, password unlock, and file downloads under `/api/v1/public/shares/:token`.
- `GET /api/v1/shared`, save/remove open shares. Password-protected links are not saved to this metadata list; open them directly so gated metadata cannot leak.
- Separate Vault setup/unlock/passphrase-change/list/upload/download/delete routes. Vault items are not included in project, share, or public-link queries.
- A protected expiration cleanup route at `GET /api/v1/cron/expire`.

### Expiration and cleanup schedule

Nitro's [scheduled-task configuration](https://nitro.build/docs/tasks) in `vite.config.ts` sets cleanup to **`0 3 * * *` (03:00 UTC daily)** and the production build emits the cron route at `/_vercel/cron`. This once-daily schedule is compatible with Vercel Hobby's daily cron limit; Hobby may invoke it at any point in the scheduled hour ([Vercel schedule limits](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). Nitro's cron handler validates Vercel's `Authorization: Bearer <CRON_SECRET>` header when the secret is configured, and the cleanup task fails closed if the secret is missing or shorter than 32 bytes. An authenticated manual cleanup endpoint is also available at `GET /api/v1/cron/expire`.

Expiration is enforced synchronously by public-share and public-download API reads, so a link stops working at its expiry timestamp even if scheduled cleanup has not run. Physical Blob deletion is asynchronous and batch-limited (up to 200 expired files/intents per run); large backlogs or provider errors may take additional runs. The cron is not a promise of exact-time physical erasure. Vercel invokes configured cron jobs only on production deployments, not preview deployments.

## Local backend environment

Copy the template and fill in values only when you have the corresponding services configured:

```bash
cp .env.example .env.local
```

`.env.local` is ignored by Git. Use a Private Blob store. For local Blob operations, set `BLOB_READ_WRITE_TOKEN`; local completion callbacks also need a reachable callback URL, so use Vercel's local deployment workflow or a deliberate public tunnel and set `VERCEL_BLOB_CALLBACK_URL` accordingly. The sign-in-free `/app` remains available without these values.

## Local workspace behavior and limits

- Local projects, imports, Vault metadata, and settings live in this browser's `localStorage`; clearing browser data removes them. Local share URLs are not cross-device cloud links.
- User-selected file bytes in the local workspace stay in memory for the current session and are not stored in browser storage. Seeded sample files have local sample content.
- The seeded `KYOTO7` passcode is for exercising the local flow only. The browser SHA-256 verifier is not used by the server API.
- Local analytics are sample values; they do not describe real recipients. Local project expiration/deletion does not delete a separate cloud project.
- Cloud projects created in `/cloud` are account-owned and separate from local projects and Vault metadata.

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

- `src/components/` — landing page, local browser workspace, Cloud workspace, local/public share pages, dialogs, Settings, and Vault.
- `src/services.ts`, `src/services/ports.ts`, `src/services/adapters.ts` — browser-local services and adapter contracts.
- `src/services/cloudApi.ts` — cloud API client.
- `src/types.ts` and `src/demoData.ts` — UI models and local sample data.
- `server/` — Nitro route entry and Hono API, Google token verification, Postgres access, and security helpers.
- `migrations/` and `scripts/migrate.mjs` — database schema and migration runner.
