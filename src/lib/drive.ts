/**
 * Minimal typed client over the Google Drive REST API v3.
 *
 * Hard rules enforced here (and asserted by src/lib/__tests__/drive.test.ts):
 *  - Never destroy anything: no destructive HTTP verb, no trashing, no
 *    permission removal. The one permitted Drive DELETE lives in shares.ts
 *    (`revokePermission`) and targets a ledger-recorded permissions/{id}.
 *  - Own Drive only: every files.list uses corpora=user and `'me' in owners`.
 *    The sole exception is the appDataFolder listing, which is private to this
 *    app by construction and rejects those parameters.
 *  - User-supplied text placed into a Drive `q` string is escaped.
 */
import type {
  DownloadFormat,
  DriveFile,
  FileKind,
  HotGroup,
  HotItem,
  HotList,
  SearchResponse,
  SearchType,
  ShareMode,
} from './types';
import { SHELF_COLORS, SHELF_ICONS } from './types';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const FILE_FIELDS =
  'id,name,mimeType,modifiedTime,viewedByMeTime,size,iconLink,thumbnailLink,webViewLink';
const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;

export const MIME = {
  folder: 'application/vnd.google-apps.folder',
  slides: 'application/vnd.google-apps.presentation',
  docs: 'application/vnd.google-apps.document',
  sheets: 'application/vnd.google-apps.spreadsheet',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

const HOTLIST_FILENAME = 'hotlist.json';
const CLIENT_SHARES_FOLDER = 'Client Shares';

/** An error returned by (or derived from) an upstream Drive call. */
export class DriveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit tested)                                                  */
/* -------------------------------------------------------------------------- */

/** Escape backslashes and single quotes for embedding user text in a Drive `q`. */
export function escapeQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const SEARCH_TYPE_MIME: Record<Exclude<SearchType, 'all'>, string> = {
  slides: MIME.slides,
  docs: MIME.docs,
  sheets: MIME.sheets,
  pdf: MIME.pdf,
  pptx: MIME.pptx,
  docx: MIME.docx,
  xlsx: MIME.xlsx,
};

/** Build the Drive `q` string for a user search. */
export function buildSearchQuery(q: string, type: SearchType): string {
  const esc = escapeQ(q);
  const base = `trashed = false and 'me' in owners and (name contains '${esc}' or fullText contains '${esc}')`;
  if (type === 'all') return `${base} and mimeType != '${MIME.folder}'`;
  return `${base} and mimeType = '${SEARCH_TYPE_MIME[type]}'`;
}

/** Derive the coarse `FileKind` used by the UI from a Drive mime type. */
export function kindFromMime(mime: string): FileKind {
  switch (mime) {
    case MIME.slides:
      return 'slides';
    case MIME.docs:
      return 'docs';
    case MIME.sheets:
      return 'sheets';
    case MIME.folder:
      return 'folder';
    case MIME.pdf:
      return 'pdf';
    case MIME.pptx:
      return 'pptx';
    case MIME.docx:
      return 'docx';
    case MIME.xlsx:
      return 'xlsx';
    default:
      return 'other';
  }
}

/** True for Google-native types that must be exported rather than downloaded. */
export function isNativeExportable(mime: string): boolean {
  return mime === MIME.slides || mime === MIME.docs || mime === MIME.sheets;
}

const NATIVE_EXPORT: Record<string, { mimeType: string; ext: string }> = {
  [MIME.slides]: { mimeType: MIME.pptx, ext: 'pptx' },
  [MIME.docs]: { mimeType: MIME.docx, ext: 'docx' },
  [MIME.sheets]: { mimeType: MIME.xlsx, ext: 'xlsx' },
};

/**
 * Export target for a Google-native file, or `null` when the file is not
 * exportable (a binary file, which is fetched with `alt=media` instead).
 */
export function exportTarget(
  mime: string,
  format: DownloadFormat,
): { mimeType: string; ext: string } | null {
  if (!isNativeExportable(mime)) return null;
  if (format === 'pdf') return { mimeType: MIME.pdf, ext: 'pdf' };
  return NATIVE_EXPORT[mime] ?? null;
}

const FILE_KINDS: readonly FileKind[] = [
  'slides',
  'docs',
  'sheets',
  'pdf',
  'pptx',
  'docx',
  'xlsx',
  'folder',
  'other',
];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isOptionalString(x: unknown): boolean {
  return x === undefined || typeof x === 'string';
}

function isHotItem(x: unknown): x is HotItem {
  if (!isRecord(x)) return false;
  return (
    typeof x.fileId === 'string' &&
    typeof x.name === 'string' &&
    typeof x.mimeType === 'string' &&
    typeof x.kind === 'string' &&
    FILE_KINDS.includes(x.kind as FileKind) &&
    typeof x.webViewLink === 'string' &&
    isOptionalString(x.iconLink) &&
    isOptionalString(x.label) &&
    isOptionalString(x.pinnedAt)
  );
}

/** Absent, or one of a fixed set of strings. Used for the shelf style fields. */
function isOptionalMember(x: unknown, allowed: readonly string[]): boolean {
  return x === undefined || (typeof x === 'string' && allowed.includes(x));
}

function isHotGroup(x: unknown): x is HotGroup {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Array.isArray(x.items) &&
    x.items.every(isHotItem) &&
    // Shelf identity (DESIGN_PLAN §7): optional, but if present it must be a
    // known value — an unknown hue would resolve to no CSS vars at all.
    isOptionalMember(x.color, SHELF_COLORS) &&
    isOptionalMember(x.icon, SHELF_ICONS)
  );
}

/** Structural validation of a client-supplied hot list payload. */
export function validateHotList(x: unknown): x is HotList {
  if (!isRecord(x)) return false;
  if (x.version !== 1) return false;
  if (!Array.isArray(x.groups) || !x.groups.every(isHotGroup)) return false;
  if (!isRecord(x.settings)) return false;
  if (!isOptionalString(x.settings.clientSharesFolderId)) return false;
  return true;
}

/** Trim a client name and strip path separators. Does not enforce length. */
export function sanitizeClientName(s: string): string {
  return s.replace(/[/\\]/g, '').trim();
}

/** True when a raw list entry carries a usable file id. */
function hasFileId(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.id === 'string' && raw.id.length > 0;
}

/** Map a raw Drive file resource onto our `DriveFile` shape. */
export function toDriveFile(raw: unknown): DriveFile {
  const r = isRecord(raw) ? raw : {};
  const mimeType = typeof r.mimeType === 'string' ? r.mimeType : 'application/octet-stream';
  const sizeNum = typeof r.size === 'string' ? Number(r.size) : typeof r.size === 'number' ? r.size : NaN;
  const id = typeof r.id === 'string' ? r.id : '';
  const viewedByMeTime = typeof r.viewedByMeTime === 'string' ? r.viewedByMeTime : undefined;
  // `modifiedTime` is occasionally absent (shortcuts, partial fields). Fall back
  // rather than emit an empty string the UI would have to render as a date.
  const modifiedTime =
    typeof r.modifiedTime === 'string'
      ? r.modifiedTime
      : (viewedByMeTime ?? new Date(0).toISOString());
  return {
    id,
    name: typeof r.name === 'string' ? r.name : 'Untitled',
    mimeType,
    kind: kindFromMime(mimeType),
    modifiedTime,
    ...(viewedByMeTime ? { viewedByMeTime } : {}),
    ...(Number.isFinite(sizeNum) ? { size: sizeNum } : {}),
    ...(typeof r.iconLink === 'string' ? { iconLink: r.iconLink } : {}),
    ...(typeof r.thumbnailLink === 'string' ? { thumbnailLink: r.thumbnailLink } : {}),
    webViewLink:
      typeof r.webViewLink === 'string' && r.webViewLink
        ? r.webViewLink
        : id
          ? `https://drive.google.com/file/d/${id}/view`
          : '',
  };
}

export function defaultHotList(): HotList {
  return {
    version: 1,
    groups: [{ id: crypto.randomUUID(), name: 'Templates', items: [] }],
    settings: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Low-level fetch plumbing                                                    */
/* -------------------------------------------------------------------------- */

export function driveUrl(
  base: string,
  path: string,
  params: Record<string, string | undefined> = {},
): string {
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v);
  }
  return u.toString();
}

function url(base: string, path: string, params: Record<string, string | undefined>): string {
  return driveUrl(base, path, params);
}

async function driveError(res: Response): Promise<DriveError> {
  let message = `Drive request failed with status ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        const err = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : undefined;
        if (err && typeof err.message === 'string') message = err.message;
        else message = text.slice(0, 500);
      } catch {
        message = text.slice(0, 500);
      }
    }
  } catch {
    /* body already consumed or unreadable — keep the generic message */
  }
  return new DriveError(res.status, message);
}

export async function driveRequest(
  token: string,
  target: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(target, { ...init, headers });
  if (!res.ok) throw await driveError(res);
  return res;
}

async function driveFetch(token: string, target: string, init?: RequestInit): Promise<Response> {
  return driveRequest(token, target, init);
}

async function driveJson<T>(token: string, target: string, init?: RequestInit): Promise<T> {
  const res = await driveFetch(token, target, init);
  return (await res.json()) as T;
}

interface RawList {
  files?: unknown[];
  nextPageToken?: string;
}

async function listFiles(
  token: string,
  params: Record<string, string | undefined>,
): Promise<SearchResponse> {
  const data = await driveJson<RawList>(
    token,
    url(DRIVE_API, '/files', { corpora: 'user', fields: LIST_FIELDS, ...params }),
  );
  return {
    // An entry without an id cannot be opened, downloaded or pinned — drop it.
    files: (data.files ?? []).filter(hasFileId).map(toDriveFile),
    ...(data.nextPageToken ? { nextPageToken: data.nextPageToken } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export async function searchFiles(
  token: string,
  opts: { q: string; type?: SearchType; pageToken?: string },
): Promise<SearchResponse> {
  return listFiles(token, {
    q: buildSearchQuery(opts.q, opts.type ?? 'all'),
    pageSize: '25',
    orderBy: 'modifiedTime desc',
    pageToken: opts.pageToken,
  });
}

export async function recentFiles(token: string): Promise<SearchResponse> {
  return listFiles(token, {
    q: `trashed = false and 'me' in owners and mimeType != '${MIME.folder}'`,
    pageSize: '12',
    orderBy: 'viewedByMeTime desc',
  });
}

export async function getFile(token: string, id: string): Promise<DriveFile> {
  const raw = await driveJson<unknown>(
    token,
    url(DRIVE_API, `/files/${encodeURIComponent(id)}`, { fields: FILE_FIELDS }),
  );
  return toDriveFile(raw);
}

export interface DownloadResult {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  filename: string;
}

export async function downloadFile(
  token: string,
  id: string,
  format: DownloadFormat,
): Promise<DownloadResult> {
  const file = await getFile(token, id);
  if (file.mimeType === MIME.folder) throw new DriveError(400, 'Folders cannot be downloaded');

  const target = exportTarget(file.mimeType, format);

  if (target) {
    const res = await driveFetch(
      token,
      url(DRIVE_API, `/files/${encodeURIComponent(id)}/export`, { mimeType: target.mimeType }),
    );
    if (!res.body) throw new DriveError(502, 'Drive returned an empty response body');
    return {
      body: res.body,
      contentType: res.headers.get('content-type') ?? target.mimeType,
      filename: `${file.name}.${target.ext}`,
    };
  }

  if (format === 'pdf' && file.mimeType !== MIME.pdf) {
    throw new DriveError(400, 'This file cannot be downloaded as PDF');
  }

  const res = await driveFetch(
    token,
    url(DRIVE_API, `/files/${encodeURIComponent(id)}`, { alt: 'media' }),
  );
  if (!res.body) throw new DriveError(502, 'Drive returned an empty response body');
  return {
    body: res.body,
    contentType: res.headers.get('content-type') ?? file.mimeType,
    filename: file.name,
  };
}

export interface ShareFileResult {
  link: string;
  permissionId?: string;
  preExisting: boolean;
  nativeExpiry?: boolean;
  file: DriveFile;
}

export async function shareFile(
  token: string,
  id: string,
  opts: {
    mode: 'anyone' | 'email';
    email?: string;
    notify?: boolean;
    message?: string;
    expiresAt?: string | null;
  },
  ctx?: { hasManagedAnyone?: boolean },
): Promise<ShareFileResult> {
  const { createAnyonePermission, createEmailPermission, listPermissions } = await import(
    './shares'
  );

  if (opts.mode === 'anyone') {
    const anyone = (await listPermissions(token, id)).find((p) => p.type === 'anyone');
    if (anyone) {
      const file = await getFile(token, id);
      if (ctx?.hasManagedAnyone) {
        return {
          link: file.webViewLink,
          permissionId: anyone.id,
          preExisting: false,
          file,
        };
      }
      return { link: file.webViewLink, preExisting: true, file };
    }
    const created = await createAnyonePermission(token, id);
    const file = await getFile(token, id);
    return {
      link: file.webViewLink,
      permissionId: created.permissionId,
      preExisting: false,
      file,
    };
  }

  const email = (opts.email ?? '').trim();
  if (!email) throw new DriveError(400, 'email is required for share mode "email"');
  const created = await createEmailPermission(token, id, {
    email,
    notify: opts.notify !== false,
    ...(opts.message ? { message: opts.message } : {}),
    expiresAt: opts.expiresAt ?? null,
  });
  const file = await getFile(token, id);
  return {
    link: file.webViewLink,
    permissionId: created.permissionId,
    preExisting: false,
    nativeExpiry: created.nativeExpiry,
    file,
  };
}

async function findFolder(
  token: string,
  name: string,
  parentId: string,
): Promise<string | undefined> {
  const q =
    `name = '${escapeQ(name)}' and mimeType = '${MIME.folder}' ` +
    `and '${escapeQ(parentId)}' in parents and trashed = false and 'me' in owners`;
  const data = await driveJson<RawList>(
    token,
    url(DRIVE_API, '/files', {
      corpora: 'user',
      q,
      pageSize: '1',
      fields: 'files(id)',
    }),
  );
  const first = data.files?.[0];
  return isRecord(first) && typeof first.id === 'string' ? first.id : undefined;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const created = await driveJson<{ id?: string }>(
    token,
    url(DRIVE_API, '/files', { fields: 'id' }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: MIME.folder, parents: [parentId] }),
    },
  );
  if (!created.id) throw new DriveError(502, 'Drive did not return an id for the new folder');
  return created.id;
}

async function ensureFolder(token: string, name: string, parentId: string): Promise<string> {
  return (await findFolder(token, name, parentId)) ?? createFolder(token, name, parentId);
}

/** The real id of My Drive's root, needed to validate a cached folder's parent. */
async function rootFolderId(token: string): Promise<string> {
  const raw = await driveJson<{ id?: string }>(
    token,
    url(DRIVE_API, '/files/root', { fields: 'id' }),
  );
  if (!raw.id) throw new DriveError(502, 'Drive did not return the root folder id');
  return raw.id;
}

/**
 * Whether a cached folder id still points at *our* "Client Shares" folder.
 *
 * The id round-trips through the client-supplied hot list PUT, so a caller
 * could point it at any folder they can reach. Verify the name and the parent,
 * not just that it is an untrashed folder.
 */
async function isUsableClientSharesFolder(token: string, id: string): Promise<boolean> {
  try {
    const raw = await driveJson<{
      mimeType?: string;
      name?: string;
      trashed?: boolean;
      parents?: string[];
    }>(
      token,
      url(DRIVE_API, `/files/${encodeURIComponent(id)}`, {
        fields: 'id,name,mimeType,trashed,parents',
      }),
    );
    if (raw.mimeType !== MIME.folder) return false;
    if (raw.trashed === true) return false;
    if (raw.name !== CLIENT_SHARES_FOLDER) return false;

    const parents = Array.isArray(raw.parents) ? raw.parents : [];
    if (parents.includes('root')) return true;
    return parents.includes(await rootFolderId(token));
  } catch {
    return false;
  }
}

export interface CopyForClientResult {
  file: DriveFile;
  link: string | null;
  /** Resolved "Client Shares" folder id — persist it into the hot list settings. */
  clientSharesFolderId: string;
  permissionId?: string;
  preExisting: boolean;
  nativeExpiry?: boolean;
}

export async function copyForClient(
  token: string,
  id: string,
  opts: {
    clientName: string;
    share: ShareMode;
    email?: string;
    notify?: boolean;
    message?: string;
    expiresAt?: string | null;
  },
  hotlist: HotList,
): Promise<CopyForClientResult> {
  const clientName = sanitizeClientName(opts.clientName);
  if (!clientName) throw new DriveError(400, 'clientName is required');
  if (clientName.length > 80) throw new DriveError(400, 'clientName must be 80 characters or fewer');

  const cached = hotlist.settings.clientSharesFolderId;
  const rootFolderId =
    cached && (await isUsableClientSharesFolder(token, cached))
      ? cached
      : await ensureFolder(token, CLIENT_SHARES_FOLDER, 'root');

  const clientFolderId = await ensureFolder(token, clientName, rootFolderId);

  const source = await getFile(token, id);
  const copied = await driveJson<unknown>(
    token,
    url(DRIVE_API, `/files/${encodeURIComponent(id)}/copy`, { fields: FILE_FIELDS }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${clientName} - ${source.name}`,
        parents: [clientFolderId],
      }),
    },
  );
  const file = toDriveFile(copied);

  let link: string | null = null;
  let permissionId: string | undefined;
  let preExisting = false;
  let nativeExpiry: boolean | undefined;
  if (opts.share === 'anyone' || opts.share === 'email') {
    const shared = await shareFile(token, file.id, {
      mode: opts.share,
      ...(opts.email ? { email: opts.email } : {}),
      ...(opts.notify !== undefined ? { notify: opts.notify } : {}),
      ...(opts.message ? { message: opts.message } : {}),
      ...(opts.expiresAt !== undefined ? { expiresAt: opts.expiresAt } : {}),
    });
    link = shared.link;
    permissionId = shared.permissionId;
    preExisting = shared.preExisting;
    nativeExpiry = shared.nativeExpiry;
  }

  return {
    file,
    link,
    clientSharesFolderId: rootFolderId,
    ...(permissionId ? { permissionId } : {}),
    preExisting,
    ...(nativeExpiry !== undefined ? { nativeExpiry } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Hot list storage (appDataFolder)                                            */
/* -------------------------------------------------------------------------- */

/**
 * The one listing that does not carry `corpora=user` / `'me' in owners`: the
 * appDataFolder space is private to this app by construction, and Drive rejects
 * (or silently empties) the combination with `spaces=appDataFolder`.
 */
async function findHotListFileId(token: string): Promise<string | undefined> {
  const data = await driveJson<RawList>(
    token,
    url(DRIVE_API, '/files', {
      spaces: 'appDataFolder',
      q: `name = '${HOTLIST_FILENAME}' and trashed = false`,
      pageSize: '1',
      fields: 'files(id)',
    }),
  );
  const first = data.files?.[0];
  return isRecord(first) && typeof first.id === 'string' ? first.id : undefined;
}

export async function readHotList(token: string): Promise<HotList> {
  const fileId = await findHotListFileId(token);
  if (!fileId) return defaultHotList();

  const res = await driveFetch(
    token,
    url(DRIVE_API, `/files/${encodeURIComponent(fileId)}`, { alt: 'media' }),
  );
  const parsed: unknown = await res.json().catch(() => undefined);
  return validateHotList(parsed) ? parsed : defaultHotList();
}

export async function writeHotList(token: string, list: HotList): Promise<HotList> {
  const content = JSON.stringify(list);
  const fileId = await findHotListFileId(token);

  if (fileId) {
    await driveFetch(
      token,
      url(DRIVE_UPLOAD_API, `/files/${encodeURIComponent(fileId)}`, {
        uploadType: 'media',
        fields: 'id',
      }),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      },
    );
    return list;
  }

  const boundary = `dst-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: HOTLIST_FILENAME, parents: ['appDataFolder'] });
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--\r\n`;

  await driveFetch(token, url(DRIVE_UPLOAD_API, '/files', { uploadType: 'multipart', fields: 'id' }), {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });

  return list;
}
