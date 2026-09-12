/**
 * Minimal typed client over the Google Drive REST API v3.
 *
 * Hard rules enforced here (and asserted by src/lib/__tests__/drive.test.ts):
 *  - Never destroy anything: no destructive HTTP verb, no trashing, no permission removal.
 *  - Own Drive only: every files.list uses corpora=user and `'me' in owners`.
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

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

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
    isOptionalString(x.label)
  );
}

function isHotGroup(x: unknown): x is HotGroup {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Array.isArray(x.items) &&
    x.items.every(isHotItem)
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

/** Map a raw Drive file resource onto our `DriveFile` shape. */
export function toDriveFile(raw: unknown): DriveFile {
  const r = isRecord(raw) ? raw : {};
  const mimeType = typeof r.mimeType === 'string' ? r.mimeType : 'application/octet-stream';
  const sizeNum = typeof r.size === 'string' ? Number(r.size) : typeof r.size === 'number' ? r.size : NaN;
  return {
    id: String(r.id ?? ''),
    name: typeof r.name === 'string' ? r.name : 'Untitled',
    mimeType,
    kind: kindFromMime(mimeType),
    modifiedTime: typeof r.modifiedTime === 'string' ? r.modifiedTime : '',
    ...(typeof r.viewedByMeTime === 'string' ? { viewedByMeTime: r.viewedByMeTime } : {}),
    ...(Number.isFinite(sizeNum) ? { size: sizeNum } : {}),
    ...(typeof r.iconLink === 'string' ? { iconLink: r.iconLink } : {}),
    ...(typeof r.thumbnailLink === 'string' ? { thumbnailLink: r.thumbnailLink } : {}),
    webViewLink: typeof r.webViewLink === 'string' ? r.webViewLink : '',
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

function url(base: string, path: string, params: Record<string, string | undefined>): string {
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v);
  }
  return u.toString();
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

async function driveFetch(token: string, target: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(target, { ...init, headers });
  if (!res.ok) throw await driveError(res);
  return res;
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
    files: (data.files ?? []).map(toDriveFile),
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

export async function shareFile(
  token: string,
  id: string,
  opts: { mode: 'anyone' | 'email'; email?: string },
): Promise<{ link: string }> {
  const path = `/files/${encodeURIComponent(id)}/permissions`;

  if (opts.mode === 'anyone') {
    try {
      await driveFetch(token, url(DRIVE_API, path, { fields: 'id' }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (e) {
      // The permission may already exist; Drive answers 400/409 in that case.
      // Auth/permission failures (401/403/404) are real and must surface.
      const duplicate = e instanceof DriveError && (e.status === 400 || e.status === 409);
      if (!duplicate) throw e;
    }
  } else {
    const email = (opts.email ?? '').trim();
    if (!email) throw new DriveError(400, 'email is required for share mode "email"');
    await driveFetch(
      token,
      url(DRIVE_API, path, { sendNotificationEmail: 'false', fields: 'id' }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'user', emailAddress: email }),
      },
    );
  }

  const file = await getFile(token, id);
  return { link: file.webViewLink };
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

async function isUsableFolder(token: string, id: string): Promise<boolean> {
  try {
    const raw = await driveJson<{ mimeType?: string; trashed?: boolean }>(
      token,
      url(DRIVE_API, `/files/${encodeURIComponent(id)}`, { fields: 'id,mimeType,trashed' }),
    );
    return raw.mimeType === MIME.folder && raw.trashed !== true;
  } catch {
    return false;
  }
}

export interface CopyForClientResult {
  file: DriveFile;
  link: string | null;
  /** Resolved "Client Shares" folder id — persist it into the hot list settings. */
  clientSharesFolderId: string;
}

export async function copyForClient(
  token: string,
  id: string,
  opts: { clientName: string; share: ShareMode; email?: string },
  hotlist: HotList,
): Promise<CopyForClientResult> {
  const clientName = sanitizeClientName(opts.clientName);
  if (!clientName) throw new DriveError(400, 'clientName is required');
  if (clientName.length > 80) throw new DriveError(400, 'clientName must be 80 characters or fewer');

  const cached = hotlist.settings.clientSharesFolderId;
  const rootFolderId =
    cached && (await isUsableFolder(token, cached))
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
  if (opts.share === 'anyone' || opts.share === 'email') {
    const shared = await shareFile(token, file.id, {
      mode: opts.share,
      ...(opts.email ? { email: opts.email } : {}),
    });
    link = shared.link;
  }

  return { file, link, clientSharesFolderId: rootFolderId };
}

/* -------------------------------------------------------------------------- */
/* Hot list storage (appDataFolder)                                            */
/* -------------------------------------------------------------------------- */

async function findHotListFileId(token: string): Promise<string | undefined> {
  const data = await driveJson<RawList>(
    token,
    url(DRIVE_API, '/files', {
      corpora: 'user',
      spaces: 'appDataFolder',
      q: `name = '${HOTLIST_FILENAME}' and trashed = false and 'me' in owners`,
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
