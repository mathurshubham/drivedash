# DriveDash

A thin, mobile-first wrapper over Google Drive for a single user. It gives you a pinned
"hot list" of frequently used files (grouped however you like) plus a search box over your
own Drive, with one-tap actions to open, download, share, or copy a file into a per-client
folder. Built with Next.js 15 (App Router), Auth.js, and deployed to Cloudflare Workers via
`@opennextjs/cloudflare`.

## Setup

You need two things before this app works: a Google OAuth client (so you can sign in and
read your own Drive) and a Cloudflare account (to host the app). Follow both sections below
in order.

### (a) Google Cloud setup

1. Go to https://console.cloud.google.com/ and sign in with the Google account whose Drive
   you want this app to access.
2. Click the project dropdown at the top of the page, then **New Project**. Give it any name
   (e.g. "DriveDash") and click **Create**. Once created, make sure it's selected in
   the project dropdown.
3. In the left sidebar (or the search bar at the top), go to **APIs & Services** → **Library**.
   Search for "Google Drive API" and click **Enable**.
4. Go to **APIs & Services** → **OAuth consent screen**.
   - If your Google account belongs to a Google Workspace organization, choose **Internal**
     as the user type — only people in your organization can sign in, and there's no review
     process.
   - Otherwise choose **External**. You'll need to add your own email address under
     **Test users**. While the app is in "Testing" mode, Google limits it to 100 test users
     and — importantly — **refresh tokens expire after 7 days**. That means every 7 days
     you'll need to sign in again to get a fresh refresh token. To avoid this you would need
     to submit the app for verification and publish it, which is unnecessary for personal,
     single-user use — just be aware you'll be re-authenticating weekly.
   - Fill in the required fields (app name, user support email, developer contact email) and
     save.
5. Go to **APIs & Services** → **Credentials**. Click **Create Credentials** →
   **OAuth client ID**. Choose **Web application** as the application type. Give it a name
   (e.g. "DriveDash Web").
6. Under **Authorized redirect URIs**, add both of these (you'll fill in your actual worker
   name/account later — you can come back and add the second one after your first deploy):
   ```
   http://localhost:3000/api/auth/callback/google
   https://<worker-name>.<account>.workers.dev/api/auth/callback/google
   ```
7. Click **Create**. Copy the **Client ID** and **Client Secret** shown — you'll need both in
   the steps below.

### (b) Cloudflare setup

1. Install dependencies and log in to Cloudflare from this project directory:
   ```
   pnpm install
   pnpm dlx wrangler login
   ```
   This opens a browser tab to authorize Wrangler (Cloudflare's CLI) against your account.
2. Set the production secrets one at a time. Each command will prompt you to paste in a
   value:
   ```
   pnpm dlx wrangler secret put AUTH_SECRET
   pnpm dlx wrangler secret put AUTH_GOOGLE_ID
   pnpm dlx wrangler secret put AUTH_GOOGLE_SECRET
   pnpm dlx wrangler secret put ADMIN_EMAILS
   pnpm dlx wrangler secret put AUTH_URL
   pnpm dlx wrangler secret put AUTH_TRUST_HOST
   ```
   - `AUTH_SECRET`: generate one with `openssl rand -base64 32`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: from step (a) above.
   - `ADMIN_EMAILS`: comma-separated admin emails. Admins are always allowed, never
     count against the cap, and manage users at `/admin/users`.
   - `MAX_USERS` is a plain var in `wrangler.jsonc` (not a secret), default `30`.
     Change it there and redeploy.
   - `ALLOWED_EMAILS` is gone. The old KV `allowlist` key is imported into the user
     registry once, automatically, on the first read after deploy; delete the leftover
     secret (`wrangler secret delete ALLOWED_EMAILS`) once the migrated users show up at
     `/admin/users`.
   - `AUTH_URL`: your worker's public URL, e.g. `https://drivedash.<account>.workers.dev`
     (you may not know this until after your first deploy — you can update the secret
     afterwards with the same command).
   - `AUTH_TRUST_HOST`: `true`.
   Create the ACCESS KV namespace once (`wrangler kv namespace create ACCESS` and
   `--preview`) and put the ids in `wrangler.jsonc` under `kv_namespaces`.
3. Deploy:
   ```
   pnpm run deploy
   ```
   This builds the app and pushes it to Cloudflare Workers. The command output prints your
   worker's URL (`https://<worker-name>.<account>.workers.dev`).
4. Go back to the Google Cloud console (**APIs & Services** → **Credentials** → your OAuth
   client) and add the real redirect URI using the URL from step 3:
   ```
   https://<worker-name>.<account>.workers.dev/api/auth/callback/google
   ```
   Save. If you set a placeholder `AUTH_URL` secret earlier, update it now with the real
   worker URL using `wrangler secret put AUTH_URL`.

### Local development

> **Node version:** `wrangler` and `@opennextjs/cloudflare` need Node 22 or newer. `next dev`, tests and lint work on Node 20. With fnm: `fnm install 22 && fnm use 22` before `pnpm run preview` or `pnpm run deploy`.


1. Copy the example env file:
   ```
   cp .env.example .env.local
   ```
2. Fill in `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, and
   optionally `MAX_USERS` in `.env.local` using the values from the Google Cloud setup
   above. Keep `.dev.vars` in sync for wrangler.
3. Start the dev server:
   ```
   pnpm dev
   ```
   Visit http://localhost:3000. Any verified Google account can sign in and is registered
   automatically, up to `MAX_USERS` non-admin accounts; after that new users land on
   `/access-denied?reason=full`. Admins manage users at `/admin/users`.

## Rules

This app follows a small set of hard rules that must never be violated:

- **Never delete.** The app never calls Drive's delete, trash, `permissions.delete`, or
  `emptyTrash` endpoints. `src/lib/drive.ts` contains no `DELETE` HTTP method — this is
  enforced by an automated test.
- **Own Drive only.** Every file listing uses `corpora=user` and requires `'me' in owners`;
  shared drives (`supportsAllDrives`) are never used.
- **Open signup behind a hard cap.** Anyone with a verified Google account may sign in
  until `MAX_USERS` non-admin accounts are registered (default 30, clamped 1..100).
  Admins (`ADMIN_EMAILS`) are always allowed and never counted. Admins can **block** a
  user (they keep their slot, so blocking does not free capacity) or **remove** one
  (which frees a slot) at `/admin/users`.
- Refused users are redirected to `/access-denied?reason=full|blocked`;
  `/api/access/me` answers for any signed-in session so that page can explain itself.
- Every other `/api/*` route requires a valid session (`401` otherwise) and an allowed
  user (`403 { error: 'full' | 'blocked' }`). Admin routes return `403 forbidden` for
  non-admins.
- **KV write budget.** The Cloudflare KV free tier allows 1,000 writes/day. Each isolate
  counts its own writes per UTC day: `lastSeenAt` refreshes happen at most once per user
  per 24h and are dropped past 200 writes, and registration/block/remove writes fail with
  `503 { error: 'kv_budget_exceeded' }` past 500. The admin page shows the counters.
- The Google access token never reaches the browser — it's only ever read server-side.
