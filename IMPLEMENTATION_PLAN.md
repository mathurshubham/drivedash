# Implementation Plan — Doc Sharing Tool, Phase 2

Written 2026-09-12. Three features, in build order:

1. **Branding pages** (home, privacy policy, terms) — prerequisite for publishing the Google OAuth app.
2. **Share expiry, share log, email notifications** — expiring links, a per-user ledger of every share, revoke/extend, on-open sweep.
3. **Access requests and admin user management** — signed-in users can request access; admins approve from inside the app; allowlist moves from an env var to Cloudflare KV.

Each feature has: context, data model, API contract, UI, tests, deployment steps, and acceptance criteria. Read `SPEC.md` first for the phase 1 contract; this document extends it and, where stated, amends it.

---

## 0. Codebase context (read before touching anything)

### Stack and runtime facts

- Next.js **16.3.5** App Router, React 19, TypeScript strict, Tailwind v4 (CSS-first config in `src/app/globals.css`), pnpm.
- Auth: `next-auth@5.0.0-beta.32` (Auth.js v5), Google provider, JWT sessions, **lazy config** `NextAuth(() => ({...}))` so env vars are read per request (required on Workers).
- Hosting: Cloudflare Workers via `@opennextjs/cloudflare@1.20.6` + `wrangler@4.x`. Deployed at `https://doc-sharing-tool.mathurshubham.workers.dev`. Node **22** is required for anything wrangler/opennext (`fnm exec --using=22.23.2 -- <cmd>`); `next dev`, tests and lint run on Node 20.
- Drive access is plain `fetch` against `https://www.googleapis.com/drive/v3` in `src/lib/drive.ts`. No `googleapis` package. Keep it that way.
- Scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck` (run `pnpm build` first — it generates `.next/types` that typecheck needs), `pnpm lint`, `pnpm test` (vitest, 74 tests), `pnpm run preview`, `pnpm run deploy`. **Always `pnpm run deploy`**, never `pnpm deploy` (pnpm built-in shadows it).
- Env: `.env.local` for `next dev`, `.dev.vars` for wrangler. **`next dev` also loads `.dev.vars`** through `initOpenNextCloudflareForDev()` and it overrides `.env.local`; keep both files identical apart from `AUTH_URL`. Production secrets are Worker secrets (`wrangler secret bulk <json>`).
- Existing env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS` (comma list), `AUTH_TRUST_HOST=true`, `AUTH_URL`.

### Next 16 specifics that bit us already

- `src/proxy.ts` replaces `middleware.ts`. Export must be a plain `function proxy(req, event)`. Because Auth.js config is lazy, `auth(handler)` resolves asynchronously; the file does `const handler = (await withAuth) as unknown as NextMiddleware; return handler(req, event)`. Do not "simplify" this.
- Route handler `params` is a Promise: `const { id } = await params`.
- `next lint` no longer exists; `pnpm lint` runs `eslint`.
- Client components use `signIn`/`signOut` from `next-auth/react` with `redirectTo`, not `callbackUrl`.

### Module map

| File | Purpose | Key exports |
|---|---|---|
| `src/lib/types.ts` | Shared types, frozen in phase 1. Phase 2 **may extend** it (additive only). | `DriveFile`, `HotList`, `HotGroup`, `HotItem`, `SearchType`, `ShareMode`, `DownloadFormat`, response types |
| `src/lib/drive.ts` | Drive REST client + pure helpers + appDataFolder storage | `MIME`, `DriveError`, `escapeQ`, `buildSearchQuery`, `kindFromMime`, `exportTarget`, `validateHotList`, `sanitizeClientName`, `toDriveFile`, `defaultHotList`, `searchFiles`, `recentFiles`, `getFile`, `downloadFile`, `shareFile`, `copyForClient`, `readHotList`, `writeHotList` |
| `src/lib/token.ts` | No next-auth import. JWT decode, refresh with in-isolate cache, allowlist | `resolveAccessToken`, `getSessionToken(req)`, `isAllowedEmail`, `isSecureRequest`, `refreshAccessToken`, `clearAccessTokenCache` |
| `src/lib/auth.ts` | Auth.js config | `handlers`, `auth`, `signIn`, `signOut`, `getAccessToken(req)` |
| `src/lib/api.ts` | Route helpers | `requireToken(req)` → `{ token, email }`, `json`, `badRequest`, `errorResponse`, `handleError`, `ApiHttpError`, re-export `DriveError` |
| `src/lib/client.ts` | Browser-side typed fetch wrappers; throws `Error(body.error)`; on 401 redirects to `/login` once via guard flag + `setTimeout` | `search`, `recent`, `getFile`, `downloadUrl`, `shareFile`, `copyForClient`, `getHotList`, `putHotList` |
| `src/proxy.ts` | Redirect unauthenticated page requests to `/login`; re-checks allowlist; matcher excludes `_next/`, `api/`, `favicon.ico`, `manifest.webmanifest`, `icons/` | `proxy`, `config` |
| `src/app/api/**` | 8 routes: `search`, `recent`, `hotlist` (GET/PUT), `files/[id]` (GET), `files/[id]/download`, `files/[id]/share`, `files/[id]/copy`, `auth/[...nextauth]` | |
| `src/app/(app)/page.tsx` | Home: search, hot list, recent, action sheet | |
| `src/app/login/page.tsx` | Login page; shows "Access denied" on `?error=AccessDenied` | |
| `src/components/*` | `TopBar`, `TypeChips`, `HotList`, `HotGroupSection`, `RecentStrip`, `SearchResults`, `FileRow`, `ActionSheet`, `GroupPicker`, `Toast`, `KindIcon`, `SignInButton`, `relativeTime.ts`, `useHotList.ts` | |
| `src/lib/__tests__/*` | `drive.test.ts` (pure helpers, stubbed fetch, no-DELETE guard), `auth.test.ts` (token resolution), `routes.test.ts` (every route returns 401 without a session; `next-auth/jwt` mocked) | |

### Conventions

- Validate request bodies by hand, return `400 { error }`. No zod.
- Every API route: `try { const { token } = await requireToken(req); ... } catch (e) { return handleError(e) }`.
- Drive user text in `q` strings goes through `escapeQ`.
- Own Drive only: `corpora=user` and `'me' in owners` on every `files.list` except appDataFolder lookups (`spaces=appDataFolder`, no corpora).
- appDataFolder files are found by name and created via multipart upload; see `readHotList`/`writeHotList` for the exact pattern to copy for the new `shares.json`.
- UI: mobile-first, max-width 640px, 44px tap targets, dark mode via `prefers-color-scheme`, no component libraries, own `Toast`, `ActionSheet` is a bottom sheet with focus trap and body-pin scroll lock. Clipboard writes must start inside the click handler (see `copyLinkFromPromise` in `ActionSheet.tsx`) or iOS Safari rejects them.
- Hot list writes are serialized and coalesced in `useHotList.ts`. Reuse the same queue pattern for the shares ledger hook.
- Commits: conventional commits, one logical change per commit.

### The never-delete rule (amended in feature 2)

Phase 1: no HTTP DELETE anywhere in `drive.ts`, no `trashed: true`, no `emptyTrash`. Enforced by regex tests in `drive.test.ts`.

Phase 2 amendment: exactly **one** DELETE call site is permitted, inside a function named `revokePermission(entry: ShareEntry)` in `src/lib/shares.ts` (new file), targeting `permissions/{id}` where the id comes from our own ledger. `drive.ts` itself still has zero DELETEs. Files are never deleted or trashed. Tests updated accordingly (see §2.7).

### Google OAuth facts that shape features 1 and 3

- Google Cloud project `doc-sharing-tool`, id `scenic-patrol-508413-b7`, owned by `mathurshubham@gmail.com`. Consent screen **External**, status **Testing**, one test user.
- Scope `https://www.googleapis.com/auth/drive` is **restricted**. Publishing unverified is allowed; users get the "Google hasn't verified this app" screen once, and there is a 100-user lifetime cap. We will not seek verification.
- "Publish app" is disabled until the Branding page has: app home page URL, privacy policy URL, terms of service URL, and an authorised domain. That is why feature 1 exists.
- In Testing mode refresh tokens expire after 7 days; after publishing they do not. Feature 3's request-access flow assumes the app is published (Google must let unknown users reach our app).

---

## 1. Branding pages

### 1.1 Goal

Serve three public, unauthenticated pages on the Worker so the Google consent screen can link to them and the app can be published:

| Path | Purpose |
|---|---|
| `/` for signed-out users is a redirect to `/login`. Google needs a **home page** that describes the app, so add `/about`. | App home page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

All three must be reachable without a session and must render as plain HTML with the same look as the login page.

### 1.2 Routing changes

- `src/proxy.ts` matcher: add `about`, `privacy`, `terms` as **exact** paths (optional trailing slash) so lookalikes like `/aboutx` stay protected. Matcher:
  `'/((?!_next/|api/|favicon.ico|manifest.webmanifest|icons/|about/?$|privacy/?$|terms/?$).*)'`
  Also short-circuit inside `proxy()` with `/^\/(about|privacy|terms)\/?$/` before awaiting auth.
- New files: `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`. Server components, no client JS. Shared layout component `src/components/LegalPage.tsx` (title, last-updated date, prose container, footer with links to the other two pages and to `/login`).
- `src/app/login/page.tsx`: add a small footer line "Privacy · Terms · About".

### 1.3 Content requirements (Google checks these when/if you ever verify; write them properly now)

Privacy policy must state, in plain language:

- Who operates the app (name + contact email `mathurshubham@gmail.com`).
- What Google data is accessed: Drive file metadata and content via the `drive` scope; app configuration in the hidden appDataFolder via `drive.appdata`; name and email via `openid email profile`.
- How it is used: to search, open, download, share and copy the signed-in user's own Drive files on their explicit instruction.
- What is stored and where: **nothing server-side**. Session is an encrypted cookie in the user's browser. Hot list and share log are JSON files in the user's own Drive appDataFolder. (After feature 3: the allowlist of approved emails and pending access requests are stored in Cloudflare KV; say so.)
- What is not done: no selling, no advertising, no sharing with third parties, no use for AI training, no access outside the signed-in user's own actions.
- Limited Use disclosure: "Doc Sharing Tool's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements." Link: `https://developers.google.com/terms/api-services-user-data-policy`.
- How to revoke: `https://myaccount.google.com/permissions`, and how to request deletion (email).
- Retention: cookie 30 days; appDataFolder files persist until the user removes the app's data or deletes the files; KV entries until an admin removes them.
- Last updated date.

Terms of service, short: personal/internal tool, provided as-is, user is responsible for what they share, no warranty, governed by Indian law (owner is in India; adjust if wrong), contact email.

About page: two paragraphs on what the tool does, who it is for, a "Sign in" button linking to `/login`.

Do not invent a company name. Operator is the individual.

### 1.4 Google console steps (manual, after deploy)

1. Branding page: App home page `https://doc-sharing-tool.mathurshubham.workers.dev/about`, Privacy `…/privacy`, Terms `…/terms`. Authorised domain `mathurshubham.workers.dev` is already present. Save.
2. Audience page → **Publish app** → confirm.
3. Verify by opening an incognito window with a non-tester Google account: the "Google hasn't verified this app" screen appears with Advanced → Go to Doc Sharing Tool (unsafe). Do not add a logo (uploading a logo forces verification).

### 1.5 Tests and acceptance

- `routes.test.ts` style test or a new `pages.test.ts`: proxy `config.matcher` regex does not match `/about`, `/privacy`, `/terms`, and still matches `/`, `/shares`, `/apifoo`.
- Manual: `curl -I` each page returns 200 without cookies; `/` still 307s to `/login`.
- Acceptance: Publish button enabled and clicked; a second Google account can reach `/login` → consent → our AccessDenied page (feature 3 changes that page later).

---

## 2. Share expiry, share log, email notifications

### 2.1 Goal and user-visible behaviour

- Every share created from the app (anyone-link, email, copy-for-client) gets an **expiry**: 1 day, 3 days, 7 days, or none. Default 3 days.
- Email shares use Drive's native `expirationTime`; Google removes them itself.
- Anyone-links have no native expiry. The app records them in a ledger and **revokes expired ones when the app is opened** ("on-open sweep"). No cron. The UI says so.
- Email shares now **send Google's notification email** (`sendNotificationEmail=true`) with an optional message. A toggle lets the user turn the email off.
- A **Share log** page lists every share ever made from the app, active and historical, with Revoke and Extend actions.
- Pre-existing public files are never touched: if a file already had an `anyone` permission before the app shared it, the app just copies the link and logs it as "external"; no revoke is offered.

### 2.2 Data model — `shares.json` in appDataFolder

New file, sibling of `hotlist.json`, one per user. Add to `src/lib/types.ts`:

```ts
export type ShareKind = 'anyone' | 'email' | 'copy' | 'external';
export type ShareStatus = 'active' | 'expired' | 'revoked' | 'private' | 'external';
export type RevokedBy = 'you' | 'sweep' | 'google';
export type ExpiryDays = 1 | 3 | 7 | null;

export interface ShareEntry {
  id: string;                 // crypto.randomUUID()
  kind: ShareKind;
  status: ShareStatus;
  fileId: string;             // the file the permission is on (for 'copy', the copy's id)
  fileName: string;
  webViewLink: string;
  permissionId?: string;      // absent for 'external' and for copy with shareKind 'none'
  // email shares
  email?: string;
  notified?: boolean;         // true when Google's notification email was sent
  message?: string;           // the optional message, max 500 chars, stored for the log
  nativeExpiry?: boolean;     // true when Drive accepted expirationTime
  // copy-for-client shares
  copyOf?: string;            // original file id
  clientName?: string;
  shareKind?: ShareMode;      // 'anyone' | 'email' | 'none' — how the copy was shared
  // lifecycle
  createdAt: string;          // ISO
  expiresAt: string | null;   // ISO or null = never
  revokedAt?: string;
  revokedBy?: RevokedBy;
  note?: string;              // e.g. 'file no longer exists'
}

export interface ShareLedger {
  version: 1;
  lastSweepAt: string | null;
  shares: ShareEntry[];
}
```

Rules:

- Entries are never deleted, only status-changed. Cap 500 entries; when exceeded, drop the oldest entries whose status is not `active`, then oldest overall.
- `status` semantics: `active` (permission live, may expire), `expired` (sweep or Google removed it), `revoked` (user pressed Revoke), `private` (copy created with shareKind `none`, nothing to revoke), `external` (file was already public; we did not create the permission).
- Default ledger when the file is missing: `{ version: 1, lastSweepAt: null, shares: [] }`. Not created until first write.

### 2.3 Server library — new `src/lib/shares.ts`

Depends on `drive.ts` for `driveFetch`-style plumbing. Either export a small `driveRequest(token, url, init)` from `drive.ts` or duplicate the 20-line helper; prefer exporting. Functions:

```ts
export function defaultLedger(): ShareLedger
export function validateLedger(x: unknown): x is ShareLedger
export function expiryToDate(days: ExpiryDays, now?: Date): string | null     // pure, tested
export function pruneLedger(l: ShareLedger, max = 500): ShareLedger           // pure, tested
export function sanitizeMessage(s: string): string                            // trim, strip control chars, cap 500

export async function readLedger(token: string): Promise<ShareLedger>         // same pattern as readHotList
export async function writeLedger(token: string, l: ShareLedger): Promise<ShareLedger>

export async function listPermissions(token: string, fileId: string): Promise<Array<{ id: string; type: string; role: string; emailAddress?: string }>>
export async function hasAnyonePermission(token: string, fileId: string): Promise<boolean>

export async function createAnyonePermission(token: string, fileId: string): Promise<{ permissionId: string }>
export async function createEmailPermission(token: string, fileId: string, opts: {
  email: string; notify: boolean; message?: string; expiresAt: string | null;
}): Promise<{ permissionId: string; nativeExpiry: boolean }>
export async function patchPermissionExpiry(token: string, fileId: string, permissionId: string, expiresAt: string | null): Promise<void>

/** THE ONLY DELETE CALL SITE IN THE CODEBASE. Takes a ledger entry, never a raw id. */
export async function revokePermission(token: string, entry: ShareEntry): Promise<'revoked' | 'already-gone'>

export async function sweep(token: string, now?: Date): Promise<{ ledger: ShareLedger; revoked: number; expired: number; failed: number }>
```

Behaviour details:

- `createEmailPermission`: `POST /files/{id}/permissions?sendNotificationEmail={notify}&emailMessage={message when notify}&fields=id,expirationTime` with body `{ role: 'reader', type: 'user', emailAddress, expirationTime? }`. If Drive returns 400 mentioning `expirationTime` (some account policies reject it), retry once without it and return `nativeExpiry: false`. `emailMessage` only when `notify` is true and message non-empty.
- `createAnyonePermission`: `POST … { role: 'reader', type: 'anyone' }` with `fields=id`. Drive typically returns id `anyoneWithLink`; store whatever comes back.
- `revokePermission`: `DELETE /files/{fileId}/permissions/{permissionId}`. 204 → `'revoked'`. 404 → `'already-gone'` (also when the file itself is gone). Other status → throw `DriveError`. Refuse (throw) if `entry.permissionId` is missing or `entry.kind === 'external'`.
- `sweep`:
  1. `readLedger`.
  2. For each entry with `status === 'active'` and `expiresAt !== null` and `expiresAt <= now`:
     - `kind` in `anyone`, or `copy` with `shareKind === 'anyone'`: call `revokePermission`; on success or already-gone set `status: 'expired', revokedAt: now, revokedBy: 'sweep'`; on other error leave active, count `failed`.
     - `kind === 'email'`, or `copy` with `shareKind === 'email'`: if `nativeExpiry` true → set `status: 'expired', revokedBy: 'google'` without a Drive call. If `nativeExpiry` false → treat like anyone (we must revoke it ourselves).
  3. Set `lastSweepAt = now`, prune, `writeLedger` only if anything changed or `lastSweepAt` moved by more than 10 minutes (avoid a write per open).
  4. Return counts.
- Concurrency: reads and writes of the ledger are last-writer-wins. The client serializes its own calls (§2.6). Acceptable for a single user.

### 2.4 Changes to existing server code

`src/lib/drive.ts`:

- `shareFile(token, id, opts)` signature extends to `{ mode: 'anyone' | 'email'; email?: string; notify?: boolean; message?: string; expiresAt?: string | null }` and **returns** `{ link: string; permissionId?: string; preExisting: boolean; nativeExpiry?: boolean }`. Internally: for `anyone`, call `hasAnyonePermission` first; if true return `preExisting: true` with no write. Move the permission POSTs into `shares.ts` and have `shareFile` call them, or the other way round; one home only. Change `sendNotificationEmail` from hard-coded `'false'` to the `notify` flag (default **true**).
- `copyForClient(...)` accepts the same extra fields and returns the `shareFile` result alongside `file`.

`src/app/api/files/[id]/share/route.ts`:

- Body: `{ mode: 'anyone' | 'email'; email?: string; notify?: boolean; message?: string; expiresInDays?: 1 | 3 | 7 | null }`. Validate: `expiresInDays` in the set or absent (default 3); `message` string ≤ 500 after sanitize; `notify` boolean default true; email regex as today.
- After sharing, append a `ShareEntry` to the ledger (`readLedger` → push → `writeLedger`) and return `{ link, entry }`. For `preExisting`, the entry has `kind: 'external', status: 'external', expiresAt: null` and no `permissionId`.

`src/app/api/files/[id]/copy/route.ts`:

- Body gains `notify`, `message`, `expiresInDays`. Ledger entry has `kind: 'copy'`, `copyOf`, `clientName`, `shareKind`, plus permission fields when shared; `status: 'private'` when `share === 'none'`. Response `{ file, link, entry }`. Keep the existing `clientSharesFolderId` persistence.

New routes:

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/shares` | — | `ShareLedger` | |
| POST | `/api/shares/sweep` | — | `{ revoked, expired, failed, ledger }` | idempotent |
| DELETE | `/api/shares/[shareId]` | — | `{ entry }` | Revoke now. Sets `status: 'revoked', revokedBy: 'you'`. 404 from Drive → still revoked, `note: 'file no longer exists'`. 400 if entry is `external`/`private`/not active. |
| PATCH | `/api/shares/[shareId]` | `{ extendDays: 7 }` | `{ entry }` | New `expiresAt = max(now, expiresAt) + 7d`. For email with `nativeExpiry` also `patchPermissionExpiry`. 400 if not active or `expiresAt === null`. |

All under `requireToken`. `routes.test.ts` must cover the four new handlers' 401 path.

### 2.5 Types for the client contract (`src/lib/types.ts`, additive)

```ts
export interface ShareRequest { mode: 'anyone' | 'email'; email?: string; notify?: boolean; message?: string; expiresInDays?: ExpiryDays }
export interface ShareResponse { link: string; entry: ShareEntry }               // replaces { link }
export interface CopyRequest { clientName: string; share: ShareMode; email?: string; notify?: boolean; message?: string; expiresInDays?: ExpiryDays }
export interface CopyResponse { file: DriveFile; link: string | null; entry: ShareEntry }
export interface SweepResponse { revoked: number; expired: number; failed: number; ledger: ShareLedger }
```

`src/lib/client.ts` adds `getShares()`, `sweepShares()`, `revokeShare(id)`, `extendShare(id, days)`, and updates `shareFile`/`copyForClient` body types.

### 2.6 UI

**ActionSheet changes** (`src/components/ActionSheet.tsx`):

- "Share link (anyone)" now opens a sub-form instead of firing immediately: `ExpiryChips` (1 day · 3 days · 7 days · No expiry, default 3), grey helper text: *"Expired links are revoked the next time you open the app. For scheduled revocation, contact the developer."*, primary button **Share**. On submit: `copyLinkFromPromise(shareFile(...).then(r => r.link))` (must start inside the click handler), toast `Link copied · expires in 3 days` or `Link copied · file was already public, not managed here`.
- "Share to email" sub-form: email input, **Notify by email** toggle (default on), **Message** textarea (visible only when toggle on, placeholder "Optional note included in Google's email", maxLength 500, counter), `ExpiryChips`, same helper text, button **Share**. Toast `Emailed to x@y.com · expires in 3 days` (or `Shared with x@y.com` when notify off).
- "Copy for client" sub-form: existing fields + `ExpiryChips`; when share mode is email, the notify toggle and message field appear. Toast `Copy created for Acme · link expires in 3 days`.
- New component `src/components/ExpiryChips.tsx` (controlled, 4 chips, 44px tall).
- After any successful share, call `onShareCreated(entry)` so the ledger hook can add it without a refetch.

**Share log page** — `src/app/(app)/shares/page.tsx` (protected, client component):

- Header with back link, title "Share log", search box (filters by `fileName`, `email`, `clientName`, case-insensitive).
- Amber banner when `lastSweepAt` is older than 3 days (or null) **and** there is at least one active entry with `expiresAt !== null` that is not `nativeExpiry`: *"Some links may have outlived their expiry. Sweeps run when you open the app."*
- Section **Active** (status `active`, `private`, `external`), newest first. Row = `KindIcon` + file name (link to `webViewLink`, new tab) + one sentence + right-side meta + actions:
  - anyone: "Link created for anyone" · "expires in 2d" / "no expiry" · **Revoke** **Extend 7d**
  - email, notified: "Emailed to a@b.com" · expiry · **Revoke** **Extend 7d**
  - email, not notified: "Shared with a@b.com (no email sent)" · same
  - copy + anyone: "Copy created for Acme, link for anyone" · expiry · **Revoke** **Extend 7d** **Open copy**
  - copy + email: "Copy created for Acme, emailed to a@b.com" · same
  - copy + none (`private`): "Copy created for Acme, not shared" · **Open copy**
  - external: "Link copied, file was already public before this app" · **Open sharing in Drive** (`webViewLink`)
- Section **History** (status `expired`, `revoked`), greyed, newest first: same sentence plus "Revoked by you · 3d ago" / "Revoked automatically, expired · 1d ago" / "Expired, removed by Google · 2d ago", and `note` when present.
- **Revoke** is two-tap: first tap turns the button into "Confirm revoke" for 4 seconds, second tap executes. No `window.confirm`.
- **Extend 7d** disabled when `expiresAt === null`.
- Empty state: "No shares yet. Share a file from the home screen."

**Home page additions** (`src/app/(app)/page.tsx`):

- On mount, once per 10 minutes (store `lastSweepAttempt` in `sessionStorage`, try/catch), call `sweepShares()`. If `revoked + expired > 0` toast `Revoked N expired links`. Errors (incl. 401) are silent.
- Under the hot list, a line `N active shares · M expire today` linking to `/shares`; hidden when N is 0.
- Top-bar overflow menu gains "Share log".

**Hook** — `src/components/useShares.ts`: same shape as `useHotList` (`ledger`, `loading`, `error`, `ready`, `refresh`, `add(entry)`, `revoke(id)`, `extend(id, 7)`, `sweep()`), optimistic updates, serialized writes, revert to confirmed snapshot on failure, toast on error.

Date formatting: extend `relativeTime.ts` with `relativeFuture(iso)` → "in 2d", "in 5h", "today", "expired".

### 2.7 Tests

`src/lib/__tests__/shares.test.ts` (new):

- `expiryToDate(1|3|7|null)` exact offsets; `null` → `null`.
- `pruneLedger`: keeps all active, drops oldest non-active first, respects cap.
- `sanitizeMessage`: trims, strips ` -` except `\n`, caps at 500.
- `validateLedger` accept/reject cases.
- Stubbed-fetch tests: `createEmailPermission` sends `sendNotificationEmail=true`, `emailMessage`, and `expirationTime`; retries without `expirationTime` on a 400 that mentions it and reports `nativeExpiry: false`; `createAnyonePermission` body; `revokePermission` uses `method: 'DELETE'` on the right URL, maps 404 → `'already-gone'`, throws on `external` entries and on missing `permissionId`.
- `sweep` with stubbed fetch and fixed `now`: expired anyone → DELETE called, status `expired`, `revokedBy: 'sweep'`; expired email with `nativeExpiry` → no DELETE, `revokedBy: 'google'`; not-yet-expired untouched; `expiresAt: null` untouched; a 500 from Drive leaves the entry active and counts `failed`.

`src/lib/__tests__/drive.test.ts` guard update:

- Keep asserting `drive.ts` has **zero** `method: 'DELETE'`, no `trashed: true`, no `emptyTrash`.
- Add: `shares.ts` contains **exactly one** match of `/method\s*:\s*['"`]DELETE['"`]/`, and it appears inside the text of the `revokePermission` function (slice the source between `export async function revokePermission` and the next `export`). `shares.ts` also has no `trashed: true` / `emptyTrash` and no DELETE whose URL does not contain `/permissions/`.

`routes.test.ts`: add the 4 new routes to the 401 sweep.

### 2.8 Migration and deployment

- No schema migration; `shares.json` is created on first share. Existing `hotlist.json` untouched.
- `SPEC.md`: update the never-delete rule text, the share/copy API rows, add the new routes and the ledger section (copy from this document).
- Deploy: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`, then `fnm exec --using=22.23.2 -- pnpm run deploy`. No new secrets.

### 2.9 Acceptance

1. Share a private file with "anyone, 1 day" → link works in an incognito window → edit `expiresAt` in the ledger to the past via a test hook or wait → open the app → toast "Revoked 1 expired link" → link now 403s in incognito.
2. Share a file that was already public → log shows "external" row, no Revoke button, file's sharing unchanged in Drive UI.
3. Email share with message, notify on → recipient receives Google's email containing the message → Drive UI shows the permission with an expiry date → Share log shows "Emailed to".
4. Notify off → no email; log says "Shared with".
5. Copy for client with email → copy exists in `Client Shares/<Client>/`, email sent, row shows "Copy created for …, emailed to …".
6. Revoke from the log → permission gone in Drive within seconds; row moves to History as "Revoked by you".
7. Extend 7d on an email share → Drive UI expiry moves by 7 days.
8. All tests pass; the DELETE guard fails if a second DELETE is added anywhere.

---

## 3. Access requests and admin user management

### 3.1 Goal and user-visible behaviour

- Any Google account can sign in (app is published). If the email is not approved, the user lands on `/request-access` instead of "Access denied": *"You are signed in as x@y.com but not approved yet."* Button **Request access** with an optional note (≤ 300 chars). After submitting: *"Request sent. You can sign in once approved."* and the user is signed out.
- Admins see a badge in the top bar when requests are pending and manage everything at `/admin/users`: pending requests (Approve / Decline), approved users (Remove), and admins (read-only list from env).
- The allowlist moves from the `ALLOWED_EMAILS` env var to **Cloudflare KV**. `ADMIN_EMAILS` env var (comma list) defines admins; admins are always allowed. `ALLOWED_EMAILS` is kept only as a one-time seed and can be removed after migration.
- Removal takes effect on the user's next request (every API call and page load checks the allowlist).

### 3.2 Infrastructure — Cloudflare KV

One-time commands (Node 22):

```
fnm exec --using=22.23.2 -- pnpm exec wrangler kv namespace create ACCESS
fnm exec --using=22.23.2 -- pnpm exec wrangler kv namespace create ACCESS --preview
```

Add to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "ACCESS", "id": "<id from first command>", "preview_id": "<id from second>" }
]
```

Access the binding in code with `getCloudflareContext()` from `@opennextjs/cloudflare`:

```ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
const { env } = await getCloudflareContext({ async: true });
const kv = (env as { ACCESS?: KVNamespace }).ACCESS;
```

This works in `next dev` too because `next.config.ts` already calls `initOpenNextCloudflareForDev()` (it spins up a local miniflare with a local KV). Run `pnpm exec wrangler types` once to generate `cloudflare-env.d.ts` with the `KVNamespace` type, or declare a minimal interface locally. Add the generated file to git.

Fallback when the binding is missing (unit tests, misconfiguration): `src/lib/access.ts` must not crash; it falls back to an in-memory Map and logs a warning once. Tests inject a fake KV.

Free tier: 100k reads/day, 1k writes/day, 1 GB. Our load: one read per request (cached 60s per isolate), a handful of writes per week.

### 3.3 Data model (KV)

| Key | Value (JSON) |
|---|---|
| `allowlist` | `{ version: 1, emails: string[], updatedAt: string, updatedBy: string }` — lowercase, trimmed, deduped |
| `requests` | `{ version: 1, items: AccessRequest[] }` |

```ts
export interface AccessRequest {
  email: string;            // verified from the Google JWT, lowercase
  name?: string;            // from the JWT
  note?: string;            // ≤ 300 chars, sanitized
  requestedAt: string;      // ISO
  status: 'pending' | 'approved' | 'declined';
  decidedAt?: string;
  decidedBy?: string;       // admin email
}
```

Rules: one pending request per email (re-request updates `note` and `requestedAt`, does not duplicate). Declined emails may request again after 7 days; the UI says so. Cap `requests.items` at 200, drop oldest decided first.

### 3.4 Server library — new `src/lib/access.ts`

No next-auth import (so it is unit-testable like `token.ts`).

```ts
export interface AccessStore { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }
export function getStore(): Promise<AccessStore>            // KV binding via getCloudflareContext, or in-memory fallback

export function adminEmails(): string[]                     // from ADMIN_EMAILS env
export function isAdminEmail(email: string | null | undefined): boolean

export async function getAllowlist(store?: AccessStore): Promise<string[]>        // cached 60s per isolate; includes seed from ALLOWED_EMAILS on first read if KV key missing
export async function isAllowed(email: string | null | undefined, store?: AccessStore): Promise<boolean>  // admin || allowlist
export async function addToAllowlist(email: string, by: string, store?: AccessStore): Promise<string[]>
export async function removeFromAllowlist(email: string, by: string, store?: AccessStore): Promise<string[]>   // refuses to remove an admin

export async function getRequests(store?: AccessStore): Promise<AccessRequest[]>
export async function upsertRequest(r: { email: string; name?: string; note?: string }, store?: AccessStore): Promise<AccessRequest>
export async function decideRequest(email: string, decision: 'approved' | 'declined', by: string, store?: AccessStore): Promise<AccessRequest>  // 'approved' also calls addToAllowlist
export function invalidateAllowlistCache(): void            // called after any write; tests call it in beforeEach
```

### 3.5 Auth changes

`src/lib/token.ts`: `isAllowedEmail` stays as the **synchronous env check** but is renamed `isEnvAllowedEmail` and used only as the seed source. New async `isAllowed` from `access.ts` is the gate.

`src/lib/auth.ts`:

- `signIn` callback: return `true` for any verified Google email (Google's gate already passed). Do **not** reject here, otherwise the user gets Auth.js's `AccessDenied` and never reaches `/request-access`. Keep the `email_verified` check.
- `jwt` callback: add `token.isAdmin = isAdminEmail(token.email)`; no allowlist lookup in the JWT (it would freeze the decision for 30 days).
- `session` callback: expose `session.isAdmin`.

`src/lib/api.ts`:

- `requireToken(req)` now: decode JWT → `await isAllowed(email)` → 401 if not → resolve access token. Add `requireAdmin(req)` that additionally checks `isAdminEmail` and throws `ApiHttpError(403, 'forbidden')`.
- Exception: `/api/access/request` must be callable by a **signed-in but not allowed** user. Add `requireSession(req)` that decodes the JWT and returns `{ email, name }` without the allowlist check and without needing a Drive access token.

`src/proxy.ts`:

- Unauthenticated → `/login` as today.
- Authenticated and `pathname === '/request-access'` → allow.
- Authenticated but `!(await isAllowed(email))` → redirect to `/request-access`.
- `pathname.startsWith('/admin')` and not admin → redirect to `/`.
- Add `request-access` is **not** excluded by the matcher (it needs the auth wrapper to know who the user is).

`src/app/login/page.tsx`: the `?error=AccessDenied` branch can stay for the `email_verified === false` case.

### 3.6 API routes

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/access/me` | session (no allowlist) | — | `{ email, allowed: boolean, isAdmin: boolean, pendingRequest: AccessRequest \| null }` |
| POST | `/api/access/request` | session (no allowlist) | `{ note?: string }` | `{ request }`; 429 if a declined request is younger than 7 days; 409 if already allowed |
| GET | `/api/admin/users` | admin | — | `{ admins: string[], allowlist: string[], requests: AccessRequest[] }` |
| POST | `/api/admin/users` | admin | `{ email: string }` | `{ allowlist }` (manual add, no request needed) |
| DELETE | `/api/admin/users/[email]` | admin | — | `{ allowlist }`; 400 when email is an admin |
| POST | `/api/admin/requests/[email]` | admin | `{ decision: 'approved' \| 'declined' }` | `{ request, allowlist }` |

Email path segments are URL-encoded; decode and lowercase server-side. Rate limit `/api/access/request` to one write per email per 10 minutes (compare `requestedAt`). These DELETEs are on KV data, not Drive; the DELETE guard tests only scan `drive.ts` and `shares.ts`, so no conflict, but add a comment saying so.

### 3.7 UI

- `src/app/request-access/page.tsx` (client): reads `/api/access/me`; if `allowed` → `router.replace('/')`. Otherwise shows the signed-in email, a note textarea, **Request access** button, and **Sign in with a different account** (calls `signOut({ redirectTo: '/login' })`). After success, shows the confirmation and a **Done** button that signs out. If `pendingRequest` exists, show "Request pending since …" and disable the button.
- `src/app/(app)/admin/users/page.tsx` (client, admin only; server-side guard is the proxy, client also hides on `!isAdmin`): three sections — **Pending requests** (email, name, note, requested-ago, **Approve** / **Decline**), **Approved users** (email, **Remove** two-tap confirm; admins shown with a lock icon and no Remove), **Add user** (email input + Add). Toasts on every action.
- `TopBar`: for admins, overflow menu gets "Users", and a small badge with the pending count (fetched once on mount via `/api/admin/users`, silently ignored for non-admins).
- `SignInButton` unchanged.

### 3.8 Tests

`src/lib/__tests__/access.test.ts` (new, with an in-memory `AccessStore`):

- `isAllowed`: admin always true; allowlisted true; unknown false; case-insensitive and trimmed.
- Seed: when KV has no `allowlist`, first read seeds from `ALLOWED_EMAILS` env and writes it.
- `addToAllowlist` dedupes; `removeFromAllowlist` refuses admins.
- `upsertRequest` dedupes per email and updates `note`; `decideRequest('approved')` adds to allowlist; declined + re-request within 7 days rejected.
- Cache: second `getAllowlist` within 60s does not hit the store; `invalidateAllowlistCache` forces a read.

`routes.test.ts`: new routes — 401 without session; admin routes 403 with a non-admin session (mock `getSessionToken` to return `{ email: 'user@x.com' }` and `ADMIN_EMAILS` to someone else); `/api/access/request` succeeds for a non-allowlisted session.

Proxy unit test: pure function `decideRoute({ pathname, isAuthed, isAllowed, isAdmin })` extracted from `proxy.ts` and tested for the redirect matrix.

### 3.9 Migration and deployment

1. Create the KV namespaces (§3.2), update `wrangler.jsonc`, commit.
2. Add secret `ADMIN_EMAILS=mathurshubham@gmail.com` (Worker secret and both local env files).
3. Deploy. On first request the allowlist seeds itself from `ALLOWED_EMAILS`.
4. Verify at `/admin/users` that the seed appears. Then remove `ALLOWED_EMAILS` from the Worker secrets (`wrangler secret delete ALLOWED_EMAILS`) and from the env files; code must tolerate its absence.
5. Update `README.md` (env vars, KV setup, admin flow) and `SPEC.md` hard rule 3 ("Sign-in restricted to emails in `ALLOWED_EMAILS`" → "to admins and the KV allowlist; anyone may request access").
6. Update `/privacy` to mention KV storage of emails and notes (feature 1 text).

### 3.10 Acceptance

1. A non-approved Google account signs in → lands on `/request-access` → submits → signed out.
2. Admin opens the app → badge shows 1 → `/admin/users` → Approve → user signs in and reaches `/`.
3. Remove the user → their next API call returns 401 and the client redirects to `/login`; `/` redirects to `/request-access`.
4. Non-admin visiting `/admin/users` is redirected to `/`; `GET /api/admin/users` returns 403.
5. `ALLOWED_EMAILS` deleted from secrets → app still works from KV.
6. All tests pass.

---

## 4. Build order, branching, and definition of done

Order: **1 → 2 → 3**. Feature 1 unblocks publishing, which feature 3 depends on. Feature 2 is independent of 3 but larger; doing it second keeps the auth changes in 3 isolated.

Branches: `feat/branding-pages`, `feat/share-expiry`, `feat/access-requests`. Merge each to `main` with `--no-ff` after the gates pass.

Gates per branch, in this order: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `fnm exec --using=22.23.2 -- pnpm run preview` smoke (`/login` 200, `/` 307, `/api/search?q=x` 401, plus the feature's own pages).

Non-negotiables carried over from phase 1:

- No `googleapis` package. No database other than KV for feature 3. No server-side storage of Drive data or tokens.
- No DELETE on Drive outside `revokePermission`. No trash. No file deletion.
- Access token never reaches the browser.
- `src/lib/types.ts` changes are additive only.
- Every new API route returns `401 { error: 'unauthorized' }` without a session and is covered in `routes.test.ts`.

Estimated size: feature 1 ~150 lines, feature 2 ~1,200 lines incl. tests, feature 3 ~900 lines incl. tests.
