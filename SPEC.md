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

1. **Never delete.** No calls to `files.delete`, `files/{id}` DELETE, trash (`trashed: true` PATCH),
   `permissions.delete`, or `emptyTrash`. `src/lib/drive.ts` must contain no `DELETE` HTTP method.
   A vitest test greps `src/lib/drive.ts` and fails if `'DELETE'` appears.
2. **Own Drive only.** Every `files.list` uses `corpora=user`, `supportsAllDrives` omitted/false,
   and `'me' in owners` in `q`. **One exception:** the `appDataFolder` listing that finds
   `hotlist.json` uses `spaces=appDataFolder` with `q: name = 'hotlist.json' and trashed = false`
   and no `corpora` / `'me' in owners` — that space is private to this app by construction, and
   Drive does not accept the combination.
3. Sign-in is open to any verified Google email. App access is restricted to
   admins (`ADMIN_EMAILS`) and the KV allowlist; anyone may request access.
4. All `/api/*` routes return `401 { error: 'unauthorized' }` without a valid session.
5. Access token never sent to the browser. The JWT callback stores it; pages read it via `auth()`,
   API routes decode the session cookie directly (`getToken`) so a request refreshes at most once.
6. Escape user text placed in Drive `q` strings: backslash and single quote.

## Env vars

```
AUTH_SECRET=            # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAILS=shubham.mathur@bluehorizonsgroup.com  # one-time KV seed; optional after migration
ADMIN_EMAILS=mathurshubham@gmail.com
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
export interface ShareResponse { link: string }
export interface CopyResponse { file: DriveFile; link: string | null }
export interface ApiError { error: string }
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
| POST | `/api/files/[id]/share` | `{ mode: 'anyone' \| 'email', email?: string }` | `ShareResponse` |
| POST | `/api/files/[id]/copy` | `{ clientName: string, share: ShareMode, email?: string }` | `CopyResponse` |
| GET | `/api/hotlist` | — | `HotList` |
| PUT | `/api/hotlist` | `HotList` (full replace, except the merge rule below) | `HotList` |
| GET | `/api/access/me` | session, no allowlist | `{ email, allowed, isAdmin, pendingRequest }` |
| POST | `/api/access/request` | session, no allowlist; `{ note? }` | `{ request }`; 409 if already allowed; 429 if declined < 7d or write < 10m |
| GET | `/api/admin/users` | admin | `{ admins, allowlist, requests }` |
| POST | `/api/admin/users` | admin; `{ email }` | `{ allowlist }` |
| DELETE | `/api/admin/users/[email]` | admin | `{ allowlist }`; 400 if email is an admin. KV only, not Drive. |
| POST | `/api/admin/requests/[email]` | admin; `{ decision: 'approved' \| 'declined' }` | `{ request, allowlist }` |

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
- `anyone`: `POST /files/{id}/permissions` `{ role: 'reader', type: 'anyone' }`. Idempotent enough; ignore 4xx "already exists".
- `email`: `{ role: 'reader', type: 'user', emailAddress }` with `sendNotificationEmail=false`.
- Return `webViewLink`.

### Copy semantics
1. Ensure root folder `Client Shares` in My Drive root: use `settings.clientSharesFolderId` from hotlist if present and still valid (GET it, not trashed); else find by
   `name = 'Client Shares' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false and 'me' in owners`; else create. Persist id into hotlist settings.
2. Ensure subfolder `<clientName>` under it (same find-or-create pattern).
3. `POST /files/{id}/copy` body `{ name: '<clientName> - <original name>', parents: [subfolderId] }`, fields as DriveFile.
4. Apply share per `share` mode; `none` → `link: null` (still return `file.webViewLink` in file).
Trim `clientName`; 400 if empty or > 80 chars; strip `/` and `\`.

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
- `src/lib/types.ts` is frozen. Propose changes in your final report instead of editing.

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
