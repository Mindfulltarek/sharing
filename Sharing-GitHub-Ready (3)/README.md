# Sharing — cloud-backed file handoffs

Sharing is a responsive React/Vite file-sharing app with Google sign-in, account-owned projects, cloud uploads/downloads, share pages, and a separate cloud-backed Vault. **Google sign-in is required to enter the workspace and to open a share page. Projects and Vault files are always cloud-backed, use separate cloud paths, and Vault items are never included in project shares.**

A successful Google popup alone does not prove that the database, Private Blob store, upload callbacks, or downloads are configured. Complete the server setup below before relying on cloud operations.

## Run the development server

Requirements: Node.js 20+ and npm.

```bash
npm ci --legacy-peer-deps
npm run dev
```

Use the URL printed by Vite/Nitro (normally `http://localhost:3000`). Routes:

- `/` and `/welcome` — public landing page.
- `/login` — mandatory Google sign-in.
- `/app` — authenticated account workspace.
- `/cloud` — backward-compatible alias to `/app`; it still requires sign-in.
- `/share/:token` — authenticated cloud share page. Google sign-in is required; password-protected shares also require the project password.

Copy `.env.example` to `.env.local` when configuring Google and the backend. Never put secrets in a `VITE_` variable: the Google client ID is public, but database credentials and API secrets are not. The Remember me checkbox stores only a preference so Google Identity Services may use the device's existing Google session; it does not store an ID token.

## Vercel build and backend setup

The Vite config installs Nitro's Vite plugin and targets Vercel. `npm run build` produces Vercel's Build Output API under `.vercel/output`; do not override the output directory to `dist` in project settings. The setup uses [Nitro's Vite integration](https://vercel.com/docs/frameworks/full-stack/vite-with-nitro) and [filesystem routing](https://nitro.build/docs/routing).

1. Import the repository into Vercel and use `npm run build` as the build command. The Nitro plugin selects the Vercel Node.js runtime.
2. Configure Google Auth Platform and create an OAuth **Web application** client. If the app is in Testing mode, add your Google account as a test user. Add the deployed website origin (and any development origin you use) under Authorized JavaScript origins. The implementation uses Google Identity Services popup flow; it does not need a redirect URI.
3. Create a Neon Postgres database and a **Private** Vercel Blob store. Keep the Blob store private; browser clients must never receive a read/write store token.
4. Add these variables in Vercel Project Settings. The `VITE_` value is embedded at build time, so redeploy after changing it. Apply values to Production and any Preview environments you intend to enable:
   - `VITE_GOOGLE_CLIENT_ID` — public Web client ID used by the sign-in button.
   - `GOOGLE_CLIENT_ID` — the same client ID, used by the server as the ID-token audience.
   - `DATABASE_URL` — Neon connection string.
   - `ACCESS_TOKEN_SECRET`, `SHARE_RATE_LIMIT_PEPPER`, and `CRON_SECRET` — independent random secrets, each at least 32 bytes. Generate with `openssl rand -base64 48` and use a different value for each.
   - `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` — private Blob store identifier and signed-upload callback verification key.
   - Vercel OIDC must be available to the deployed function for private Blob operations. `BLOB_READ_WRITE_TOKEN` is supported for development or where OIDC is not used; never expose it to browser code.
5. Apply the database migration once, using a trusted terminal with `DATABASE_URL` set (or pulled into `.env.local`):

   ```bash
   npm run db:migrate
   ```

6. Deploy. `GET /api/v1/health` returns 200 only after the database is configured and reachable. Vercel environment changes require a new deployment.

To verify a live deployment, test each flow separately: sign in; create a new project with a small file; confirm that the file is available through the private Blob-backed API; copy its share link; open the share in another browser/device after Google sign-in; and test a Vault upload/download. A successful sign-in does not prove database migrations, private Blob uploads, downloads, or cross-device links work.

## Authentication and cloud storage

The browser submits the Google credential to `GET /api/v1/me`. The server verifies it against Google's published keys, checks issuer, audience, expiry, and verified email, then creates or updates the account row. It never trusts a client-supplied user ID. Google credentials and scoped Vault/share tokens stay in JavaScript memory only and are cleared when the account changes.

The Cloud API owns project listing, creation, settings, uploads, downloads, and deletion. Selected file bytes are sent to the cloud after the user chooses files; project data is not saved in browser storage. Uploads use Vercel's signed private-upload flow. Project metadata is stored server-side. Share lookup, password unlock, file downloads, and save/remove actions also use the authenticated API. Password-protected share metadata is not shown before verification, and share passwords are not returned to the browser.

The Vault has its own cloud status, passphrase setup/unlock, short-lived scoped access, list, upload, download, delete, and passphrase-change routes. Vault filenames are returned only after the Vault is unlocked, and Vault entries are excluded from project and share queries. The passphrase gates Vault API access; this app does **not** claim end-to-end encryption.

The browser's file/folder picker can access only items explicitly chosen by the user. Dragging files anywhere over the account workspace starts a project; when the create-project modal is open, files can be dropped anywhere within the modal window. Upload reliability still depends on the deployment's Google, database, and private storage configuration.

## Backend included

- `server/api.ts` — Hono routes served through Nitro under `/api/v1`.
- `migrations/0001_initial.sql` and `scripts/migrate.mjs` — Postgres schema and migration command.
- `server/auth.ts` — Google credential verification and account upsert.
- `server/security.ts` — scrypt passphrase verifiers, purpose-scoped short-lived tokens, high-entropy share tokens, and keyed IP digests for rate limits.
- `server/blob.ts` — private Blob credentials and signed-upload configuration checks.
- `src/services/cloudApi.ts` — browser API client for account projects, uploads/downloads, authenticated shares, and the separate Vault.
- `src/components/Workspace.tsx` — authenticated account dashboard.
- `src/components/CloudSharePage.tsx` — authenticated cloud share and download page.

Implemented API surface:

- `GET /api/v1/me`, `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:id`, link rotation, per-file upload intents, and owner downloads.
- Authenticated share lookup, password unlock, and file downloads under `/api/v1/public/shares/:token`.
- `GET /api/v1/shared`, save/remove open shares. Password-protected links are not saved to this metadata list; open them directly so gated metadata cannot leak.
- Separate Vault setup/unlock/passphrase-change/list/upload/download/delete routes. Vault items are not included in project, share, or share-page queries.
- `GET /api/v1/health` for deployment checks and a protected expiration cleanup route at `GET /api/v1/cron/expire`.

### Expiration and cleanup schedule

Nitro's [scheduled-task configuration](https://nitro.build/docs/tasks) in `vite.config.ts` sets cleanup to **`0 3 * * *` (03:00 UTC daily)** and the production build emits the cron route at `/_vercel/cron`. This once-daily schedule is compatible with Vercel Hobby's daily cron limit; Hobby may invoke it at any point in the scheduled hour ([Vercel schedule limits](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). Nitro's cron handler validates Vercel's `Authorization: Bearer <CRON_SECRET>` header when the secret is configured, and cleanup fails closed if the secret is missing or shorter than 32 bytes. An authenticated manual cleanup endpoint is also available at `GET /api/v1/cron/expire`.

Expiration is enforced synchronously by share and download API reads, so a link stops working at its expiry timestamp even if scheduled cleanup has not run. Physical Blob deletion is asynchronous and batch-limited (up to 200 expired files/intents per run); large backlogs or provider errors may take additional runs. The cron is not a promise of exact-time physical erasure. Vercel invokes configured cron jobs only on production deployments, not preview deployments.

## Checks

```bash
npm run typecheck
npm run typecheck:api
npm test
npm run build
npm audit --omit=dev
```

Automated tests cover API authentication requirements, Google bearer propagation, scoped-token behavior, passphrase verification, expiry checks, file-path cleanup, and keyed IP digests. They do not replace interactive browser testing or authenticated integration tests against your Neon database, Google OAuth client, or Vercel Blob store.

## Project structure

- `src/components/` — landing page, mandatory Google sign-in, account workspace, authenticated cloud share page, dialogs, Settings, and Vault.
- `src/services.ts` — formatting and browser download helpers; it contains no project or file repository.
- `src/services/cloudApi.ts` — cloud API client.
- `src/types.ts` — project, file, Vault, and workspace models.
- `src/i18n.tsx` — English/Arabic language selection and RTL support.
- `server/` — Nitro route entry and Hono API, Google credential verification, Postgres access, and security helpers.
- `migrations/` and `scripts/migrate.mjs` — database schema and migration runner.
