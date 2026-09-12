# Doc Sharing Tool — Build Spec

Thin, mobile-first wrapper over Google Drive for one user. Two panels: a pinned "hot list"
grouped by user-defined groups, and a search box over the user's own Drive. Each file has
actions: Open, Download (native or PDF), Share link, Copy for client, Pin.

## Stack (fixed)

- Next.js 15 App Router, TypeScript strict, Tailwind v4, `src/` dir, `@/*` alias, pnpm.
- Auth: `next-auth@beta` (Auth.js v5), Google provider, JWT sessions (no DB).
- Hosting: Cloudflare Workers via `@opennextjs/cloudflare` + `wrangler`. `nodejs_compat` flag.
  Do NOT set `export const runtime = 'edge'` anywhere.
- Drive access: plain `fetch` against `https://www.googleapis.com/drive/v3`. NO `googleapis` npm package.
- Icons: `lucide-react`. Tests: `vitest`. No other runtime deps without a reason in the PR message.

## Hard rules

1. **Never delete files.** No calls to `files.delete`, `files/{id}` DELETE, trash (`trashed: true` PATCH),
   or `emptyTrash`. `src/lib/drive.ts` must contain no `DELETE` HTTP method. Exactly **one** Drive
   DELETE is permitted: `revokePermission` in `src/lib/shares.ts`, targeting `permissions/{id}` from
   our own share ledger. Files are never deleted or trashed. A vitest test greps both files.
2. **Own Drive only.** Every `files.list` uses `corpora=user`, `supportsAllDrives` omitted/false,
   and `'me' in owners` in `q`. **One exception:** the `appDataFolder` listing that finds
   `hotlist.json` uses `spaces=appDataFolder` with `q: name = 'hotlist.json' and trashed = false`
   and no `corpora` / `'me' in owners` — that space is private to this app by construction, and
   Drive does not accept the combination.
3. **Open signup behind a hard cap.** Anyone with a verified Google account may sign in until
   `MAX_USERS` non-admin accounts are registered; admins (`ADMIN_EMAILS`) are always allowed and
   never counted; admins can block or remove users. Registration happens on the first page load
   (the proxy calls `resolveAccess`). A blocked user keeps their slot until an admin removes them,
   so the cap counts blocked and active non-admin records alike. Refused users get
   `/access-denied?reason=full|blocked` in the browser and `403 { error: 'full' | 'blocked' }`
   from the API.
4. All `/api/*` routes return `401 { error: 'unauthorized' }` without a valid session.
5. Access token never sent to the browser. The JWT callback stores it; pages read it via `auth()`,
   API routes decode the session cookie directly (`getToken`) so a request refreshes at most once.
6. Escape user text placed in Drive `q` strings: backslash and single quote.

## Env vars

```
AUTH_SECRET=            # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ADMIN_EMAILS=mathurshubham@gmail.com
MAX_USERS=30            # hard cap on non-admin accounts; positive int, clamped 1..100, default 30
AUTH_TRUST_HOST=true
AUTH_URL=http://localhost:3000   # workers URL in prod
```

Local Next dev: `.env.local`. Wrangler preview/deploy: `.dev.vars` locally, `wrangler secret put` in prod.
Both files gitignored. `.env.example` committed.

## Google OAuth

Scopes: `openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata`
(`drive.appdata` is the documented scope for `appDataFolder`; `drive` alone is not reliably sufficient).
Authorization params: `access_type=offline`, `prompt=consent`.
JWT callback stores `accessToken`, `refreshToken`, `expiresAt` (epoch seconds). If `Date.now()/1000 > expiresAt - 60`,
refresh via `https://oauth2.googleapis.com/token` (grant_type=refresh_token). On refresh failure set `token.error = 'RefreshTokenError'`;
`auth()` consumers treat that as unauthenticated.

## Shared types — `src/lib/types.ts` (source of truth, do not diverge)

```ts
export type FileKind = 'slides' | 'docs' | 'sheets' | 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'folder' | 'other';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  kind: FileKind;                 // derived server-side from mimeType
  modifiedTime: string;           // ISO
  viewedByMeTime?: string;        // ISO
  size?: number;                  // bytes, absent for Google-native
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink: string;
}

export interface HotItem {
  fileId: string;
  name: string;
  mimeType: string;
  kind: FileKind;
  webViewLink: string;
  iconLink?: string;
  label?: string;                 // optional user override shown instead of name
}

export interface HotGroup {
  id: string;                     // crypto.randomUUID()
  name: string;
  items: HotItem[];
}

export interface HotList {
  version: 1;
  groups: HotGroup[];
  settings: {
    clientSharesFolderId?: string;   // cached id of "Client Shares" root folder
  };
}

export type SearchType = 'all' | 'slides' | 'docs' | 'sheets' | 'pdf' | 'pptx' | 'docx' | 'xlsx';
export type ShareMode = 'anyone' | 'email' | 'none';
export type DownloadFormat = 'native' | 'pdf';

export interface SearchResponse { files: DriveFile[]; nextPageToken?: string }
export interface ShareResponse { link: string; entry: ShareEntry }
export interface CopyResponse { file: DriveFile; link: string | null; entry: ShareEntry }
export interface ApiError { error: string }

export type ShareKind = 'anyone' | 'email' | 'copy' | 'external';
export type ShareStatus = 'active' | 'expired' | 'revoked' | 'private' | 'external';
export type RevokedBy = 'you' | 'sweep' | 'google';
export type ExpiryDays = 1 | 3 | 7 | null;

export interface ShareEntry {
  id: string;
  kind: ShareKind;
  status: ShareStatus;
  fileId: string;
  fileName: string;
  webViewLink: string;
  permissionId?: string;
  email?: string;
  notified?: boolean;
  message?: string;
  nativeExpiry?: boolean;
  copyOf?: string;
  clientName?: string;
  shareKind?: ShareMode;
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string;
  revokedBy?: RevokedBy;
  note?: string;
}

export interface ShareLedger {
  version: 1;
  lastSweepAt: string | null;
  shares: ShareEntry[];
}

export interface ShareRequest { mode: 'anyone' | 'email'; email?: string; notify?: boolean; message?: string; expiresInDays?: ExpiryDays }
export interface CopyRequest { clientName: string; share: ShareMode; email?: string; notify?: boolean; message?: string; expiresInDays?: ExpiryDays }
export interface SweepResponse { revoked: number; expired: number; failed: number; ledger: ShareLedger }
```

`kind` derivation:
- `application/vnd.google-apps.presentation` → slides
- `application/vnd.google-apps.document` → docs
- `application/vnd.google-apps.spreadsheet` → sheets
- `application/vnd.google-apps.folder` → folder
- `application/pdf` → pdf
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` → pptx
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → docx
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → xlsx
- else other

## API contract (all under `/api`, JSON unless noted)

| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/api/search` | `q` (string, required, min 1), `type` (SearchType, default all), `pageToken?` | `SearchResponse` |
| GET | `/api/recent` | — | `SearchResponse` (top 12 by `viewedByMeTime desc`, non-folders) |
| GET | `/api/files/[id]` | — | `DriveFile` |
| GET | `/api/files/[id]/download` | `format` (DownloadFormat, default native) | streamed bytes, `Content-Disposition: attachment; filename="..."`, correct `Content-Type` |
| POST | `/api/files/[id]/share` | `{ mode: 'anyone' \| 'email', email?: string, notify?: boolean, message?: string, expiresInDays?: 1 \| 3 \| 7 \| null }` | `ShareResponse` |
| POST | `/api/files/[id]/copy` | `{ clientName: string, share: ShareMode, email?: string, notify?: boolean, message?: string, expiresInDays?: 1 \| 3 \| 7 \| null }` | `CopyResponse` |
| GET | `/api/hotlist` | — | `HotList` |
| PUT | `/api/hotlist` | `HotList` (full replace, except the merge rule below) | `HotList` |
| GET | `/api/shares` | — | `ShareLedger` |
| POST | `/api/shares/sweep` | — | `SweepResponse` |
| DELETE | `/api/shares/[shareId]` | — | `{ entry }` |
| PATCH | `/api/shares/[shareId]` | `{ extendDays: 7 }` | `{ entry }` |
| GET | `/api/access/me` | session only, no Drive token | `{ email, allowed, isAdmin, reason?, maxUsers }` |
| GET | `/api/admin/users` | admin | `{ admins, maxUsers, users, budget: { writesToday, softLimit, hardLimit } }` |
| POST | `/api/admin/users/[email]/block` | admin; `{ blocked: boolean }` | `{ users }`; 400 if email is an admin, 404 if unknown |
| DELETE | `/api/admin/users/[email]` | admin | `{ users }`; 400 if email is an admin. KV only, not Drive. |

### Access store (KV namespace `ACCESS`)

One key, `users` → `{ version: 1, users: UserRecord[] }`, where a `UserRecord` is
`{ email, name?, firstSeenAt, lastSeenAt, blocked? }`. The phase-2 `allowlist` / `allowlist:seeded`
/ `requests` keys are dead; on the first read after deploy, a legacy `allowlist` is imported into
`users` in a single write and never read again. KV keys are never deleted.

**Block vs remove.** Block sets `blocked: true`: sign-in is denied but the record keeps its seat, so
blocking never frees capacity. Remove deletes the record and frees the seat — and it is refused with
`400 { error: 'block the user before removing' }` unless the record is already blocked, because
removal is not a ban: an unblocked account simply re-registers on its next page load and takes a
fresh seat. The admin UI therefore offers **Remove** only on blocked rows.

**Concurrency (`mutateUsers`).** `users` is one document and KV has no compare-and-swap, so every
whole-document mutation (registration, block, unblock, remove, last-seen refresh) runs as a bounded
optimistic retry: the mutation is applied to a snapshot, then `users` is re-read past the cache
immediately before the put; if the stored JSON differs from the snapshot the mutation is re-applied
to the fresh document and re-validated, up to 3 attempts. Re-validation is what makes the cap safe —
a registration that lost the last seat in the window returns `{ allowed: false, reason: 'full' }`
without writing, and a `Block` that landed in the window is not reverted. On the third attempt the
re-applied result is written regardless (last-writer-wins), unless the mutation itself refuses.
*Residual window:* the verification read and the put are not atomic, so two isolates whose reads both
land before either put can still both write, and the later put wins. That window is milliseconds
wide instead of the previous ~60s cache window; it can at worst let the registry sit one record over
`MAX_USERS`, or drop one `lastSeenAt` refresh. Cross-isolate exactness would need Durable Objects.

**KV write budget** (`src/lib/kv-budget.ts`): the free tier allows 1,000 writes/day, so each isolate
counts its own writes per UTC day. `lastSeenAt` refreshes are `optional` writes — at most one per
user per 24h, and skipped entirely once the isolate has written 200 times today. Registering,
blocking, unblocking and removing are `essential` writes and throw past 500, surfacing as
`503 { error: 'kv_budget_exceeded' }`. A skipped put does **not** invalidate the read cache: the new
value is folded into the cached document instead, so a dropped refresh is not retried on every
subsequent request. `mutateUsers` also skips its verification read when the budget is going to drop
the put, and an unknown user is refused with `full` straight from the cached document when that
document is already at the cap — so refused traffic costs no extra KV reads.

`MAX_USERS` must be a bare run of digits (`/^\d+$/`, trimmed) in 1..100; `1e2`, `30.5`, `-5`, `0`
and `abc` are all malformed and fall back to 30 with one `console.warn` per isolate. Values above
100 clamp to 100.

`GET /api/admin/users` → `AdminUsersResponse` = `{ admins, maxUsers, users, budget }`, where `budget`
is `{ writesToday, softLimit, hardLimit }` for the answering isolate.

PUT merge rule: `groups` are replaced wholesale, but if the payload omits `settings.clientSharesFolderId`
and the stored hot list has one, the server carries the stored value into what it writes — a client that
has never seen the id (or that raced a copy which just set it) must not clobber it.

Errors: `4xx/5xx` with `ApiError`. Validate bodies manually (no zod); 400 on bad input.

### Search semantics
`q` = `trashed = false and 'me' in owners and (name contains '<esc>' or fullText contains '<esc>')`
plus mime clause by `type`:
- slides/docs/sheets/pdf/pptx/docx/xlsx → `and mimeType = '<mime>'`
- all → `and mimeType != 'application/vnd.google-apps.folder'`
Params: `corpora=user`, `pageSize=25`, `orderBy=modifiedTime desc`,
`fields=nextPageToken,files(id,name,mimeType,modifiedTime,viewedByMeTime,size,iconLink,thumbnailLink,webViewLink)`.

### Download semantics
- Google-native (slides/docs/sheets): `GET /files/{id}/export?mimeType=<target>`.
  native targets: slides→pptx mime, docs→docx mime, sheets→xlsx mime. `format=pdf` → `application/pdf`.
  Filename = `<name>.<ext>`.
- Other: `GET /files/{id}?alt=media`. `format=pdf` on non-native non-pdf → 400.
- Stream `response.body` straight through; do not buffer.

### Share semantics
- Default expiry is 3 days (`expiresInDays` 1 | 3 | 7 | null). Email notify defaults to true.
- `anyone`: if the file already has an `anyone` permission, copy the link and log `kind: 'external'` (no revoke). Otherwise `POST /files/{id}/permissions` `{ role: 'reader', type: 'anyone' }` and record the permission id. Anyone-links have no native Drive expiry; the app revokes them on the next open-app sweep after `expiresAt`.
- `email`: `{ role: 'reader', type: 'user', emailAddress, expirationTime? }` with `sendNotificationEmail` from the notify flag and optional `emailMessage`. If Drive rejects `expirationTime`, retry without it and set `nativeExpiry: false`.
- Return `{ link, entry }`. The access token never reaches the browser.

### Share ledger (`shares.json` in appDataFolder)
Sibling of `hotlist.json`. Default when missing: `{ version: 1, lastSweepAt: null, shares: [] }`. Created on first write. Entries are never deleted, only status-changed. Cap 500; drop oldest non-active first, then oldest overall.

- `status`: `active` (permission live), `expired` (sweep or Google removed it), `revoked` (user pressed Revoke), `private` (copy with shareKind `none`), `external` (file was already public).
- On-open sweep (`POST /api/shares/sweep`): for each `active` entry with `expiresAt <= now`, revoke anyone (and email/`copy`+email when `nativeExpiry` is false) via `revokePermission`; native-expiry email shares are marked `expired` / `revokedBy: 'google'` without a Drive call. Write the ledger only if anything changed or `lastSweepAt` moved by more than 10 minutes.
- `DELETE /api/shares/[shareId]`: revoke now (`revokedBy: 'you'`). 404 from Drive still revokes, with `note: 'file no longer exists'`. 400 if the entry is `external` / `private` / not active.
- `PATCH /api/shares/[shareId]`: `{ extendDays: 7 }` sets `expiresAt = max(now, expiresAt) + 7d`. Email shares with `nativeExpiry` also PATCH Drive. 400 if not active or `expiresAt === null`.

### Copy semantics
1. Ensure root folder `Client Shares` in My Drive root: use `settings.clientSharesFolderId` from hotlist if present and still valid (GET it, not trashed); else find by
   `name = 'Client Shares' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false and 'me' in owners`; else create. Persist id into hotlist settings.
2. Ensure subfolder `<clientName>` under it (same find-or-create pattern).
3. `POST /files/{id}/copy` body `{ name: '<clientName> - <original name>', parents: [subfolderId] }`, fields as DriveFile.
4. Apply share per `share` mode (same notify / message / expiry as `/share`); `none` → `link: null` (still return `file.webViewLink` in file) and a ledger entry with `status: 'private'`.
Trim `clientName`; 400 if empty or > 80 chars; strip `/` and `\`. Response is `{ file, link, entry }`.

### Hotlist storage
Single file `hotlist.json` in `appDataFolder` (`spaces=appDataFolder`). Find by name; if missing return default:
`{ version: 1, groups: [{ id, name: 'Templates', items: [] }], settings: {} }`. GET never creates the file;
it is created by the first write — normally the first PUT, but `/api/files/[id]/copy` also creates it when it
has to persist `settings.clientSharesFolderId`.
PUT: validate shape (version === 1, groups array, each group id/name/items strings), then create (multipart) or
`PATCH https://www.googleapis.com/upload/drive/v3/files/{id}?uploadType=media`.

## File ownership (parallel agents — do not edit outside your area)

- **Backend agent**: `src/lib/drive.ts`, `src/lib/auth.ts`, `src/lib/api.ts` (helpers: `requireToken()`, `json()`, `errorResponse()`),
  `src/app/api/**`, `src/middleware.ts` (redirect unauthenticated page requests to `/login`), `src/lib/__tests__/**`.
- **Frontend agent**: `src/app/(app)/**` pages, `src/app/login/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`,
  `src/components/**`, `src/lib/client.ts` (typed fetch wrappers over the API contract), `public/manifest.webmanifest`, `public/icons/*`.
- **Scaffold/docs agent**: `package.json`, configs, `wrangler.jsonc`, `open-next.config.ts`, `README.md`, `.env.example`, `.gitignore`.
- `src/lib/types.ts` changes are additive only (phase 2 added the share ledger types).

## UI spec (frontend)

- Mobile-first, max-width ~640px centred, large tap targets (min 44px), dark-mode via `prefers-color-scheme`.
- `/login`: single "Sign in with Google" button (server action calling `signIn('google')`).
- `/` (protected):
  1. Sticky top bar: app name, search input (debounced 300ms), type chip row (All, Slides, Docs, Sheets, PDF, PPTX, DOCX, XLSX).
  2. When query empty: **Hot list** (groups as collapsible sections; per group: rename, move up/down, delete group (with confirm), add group at bottom) then **Recent** strip (horizontal scroll).
  3. When query non-empty: search results list with "Load more" via `nextPageToken`.
- `FileRow` component: icon (from `iconLink` or lucide by kind), name, modified date, kind badge; tap opens action sheet.
- `ActionSheet` (bottom sheet): Open (new tab, `webViewLink`), Download, Download as PDF (only if native or pdf),
  Share link (anyone) → copy to clipboard + toast, Share to email (inline input), Copy for client
  (inline form: client name, share mode radio anyone/email/none, email field) → copy resulting link + toast,
  Pin to group (group picker; if pinned already show Unpin), and for hot items: Set label, Move to group.
- Hotlist edits: optimistic local state, then `PUT /api/hotlist`; on failure revert + toast.
- Clipboard: `navigator.clipboard.writeText`; fallback: show link in a selectable input.
- Toast: minimal own implementation, no lib.
- PWA: `manifest.webmanifest` (name, short_name, `display: standalone`, theme color, icons 192/512 PNG placeholders),
  `<link rel="manifest">` + `apple-mobile-web-app-capable` metas in layout.
- Sign-out link in a small footer or top-bar menu.

## Scripts (package.json)

```
dev        next dev
build      next build
typecheck  tsc --noEmit
lint       next lint
test       vitest run
preview    opennextjs-cloudflare build && opennextjs-cloudflare preview
deploy     opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## Definition of done per agent

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass on your area. Commit on a feature branch
named `feat/<area>` with conventional-commit messages. Do not merge; report branch name and summary.
