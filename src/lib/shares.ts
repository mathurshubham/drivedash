/**
 * Per-user share ledger (`shares.json` in appDataFolder) and Drive permission
 * helpers. The one permitted Drive HTTP DELETE in this codebase lives here:
 * `revokePermission` targets `permissions/{id}` recorded in our own ledger.
 */
import {
  DRIVE_API,
  DRIVE_UPLOAD_API,
  DriveError,
  driveRequest,
  driveUrl,
} from './drive';
import type {
  ExpiryDays,
  FileKind,
  RevokedBy,
  ShareEntry,
  ShareKind,
  ShareLedger,
  ShareMode,
  ShareStatus,
} from './types';

export const LEDGER_FILENAME = 'shares.json';
const LEDGER_CAP = 500;
const SWEEP_WRITE_MIN_MS = 10 * 60 * 1000;

const SHARE_KINDS: readonly ShareKind[] = ['anyone', 'email', 'copy', 'external'];
const SHARE_STATUSES: readonly ShareStatus[] = [
  'active',
  'expired',
  'revoked',
  'private',
  'external',
];
const REVOKED_BY: readonly RevokedBy[] = ['you', 'sweep', 'google'];
const SHARE_MODES: readonly ShareMode[] = ['anyone', 'email', 'none'];
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

function isOptionalBoolean(x: unknown): boolean {
  return x === undefined || typeof x === 'boolean';
}

function isShareEntry(x: unknown): x is ShareEntry {
  if (!isRecord(x)) return false;
  if (typeof x.id !== 'string' || typeof x.fileId !== 'string') return false;
  if (typeof x.fileName !== 'string' || typeof x.webViewLink !== 'string') return false;
  if (typeof x.createdAt !== 'string') return false;
  if (x.expiresAt !== null && typeof x.expiresAt !== 'string') return false;
  if (!SHARE_KINDS.includes(x.kind as ShareKind)) return false;
  if (!SHARE_STATUSES.includes(x.status as ShareStatus)) return false;
  if (!isOptionalString(x.permissionId)) return false;
  if (!isOptionalString(x.email) || !isOptionalString(x.message)) return false;
  if (!isOptionalBoolean(x.notified) || !isOptionalBoolean(x.nativeExpiry)) return false;
  if (!isOptionalString(x.copyOf) || !isOptionalString(x.clientName)) return false;
  if (x.shareKind !== undefined && !SHARE_MODES.includes(x.shareKind as ShareMode)) return false;
  if (x.fileKind !== undefined && !FILE_KINDS.includes(x.fileKind as FileKind)) return false;
  if (!isOptionalString(x.revokedAt) || !isOptionalString(x.note)) return false;
  if (x.revokedBy !== undefined && !REVOKED_BY.includes(x.revokedBy as RevokedBy)) return false;
  return true;
}

export function defaultLedger(): ShareLedger {
  return { version: 1, lastSweepAt: null, shares: [] };
}

export function validateLedger(x: unknown): x is ShareLedger {
  if (!isRecord(x)) return false;
  if (x.version !== 1) return false;
  if (x.lastSweepAt !== null && typeof x.lastSweepAt !== 'string') return false;
  if (!Array.isArray(x.shares) || !x.shares.every(isShareEntry)) return false;
  return true;
}

export function expiryToDate(days: ExpiryDays, now?: Date): string | null {
  if (days === null) return null;
  const base = now ?? new Date();
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function pruneLedger(l: ShareLedger, max = LEDGER_CAP): ShareLedger {
  if (l.shares.length <= max) return l;
  const byCreated = (a: ShareEntry, b: ShareEntry) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const active = l.shares.filter((s) => s.status === 'active');
  const rest = l.shares.filter((s) => s.status !== 'active').sort(byCreated);
  const drop = l.shares.length - max;
  const keptRest = rest.slice(Math.min(drop, rest.length));
  let shares = [...active, ...keptRest];
  if (shares.length > max) {
    shares = [...shares].sort(byCreated).slice(shares.length - max);
  }
  return { ...l, shares };
}

/** Union by entry id. `incoming` wins on collision so a just-written share beats a stale read. */
export function mergeSharesById(stored: ShareEntry[], incoming: ShareEntry[]): ShareEntry[] {
  const byId = new Map<string, ShareEntry>();
  for (const s of stored) byId.set(s.id, s);
  for (const s of incoming) byId.set(s.id, s);
  return [...byId.values()];
}

/** Active anyone-link we created for this file. Copy rows are a different file id. */
export function findActiveAnyoneEntry(
  ledger: ShareLedger,
  fileId: string,
): ShareEntry | undefined {
  return ledger.shares.find(
    (s) => s.status === 'active' && s.fileId === fileId && s.kind === 'anyone',
  );
}

/** Re-read immediately before writing and merge by id (incoming wins). */
export async function mergeWriteLedger(
  token: string,
  entries: ShareEntry[],
  lastSweepAt?: string | null,
): Promise<ShareLedger> {
  const fresh = await readLedger(token);
  return writeLedger(
    token,
    pruneLedger({
      ...fresh,
      ...(lastSweepAt !== undefined ? { lastSweepAt } : {}),
      shares: mergeSharesById(fresh.shares, entries),
    }),
  );
}

/** Trim and strip C0 control chars except newline. Callers enforce the 500-char cap. */
export function sanitizeMessage(s: string): string {
  return s.trim().replace(/[\u0000-\u0009\u000b-\u001f]/g, '');
}

export async function findLedgerFileId(token: string): Promise<string | undefined> {
  const data = (await (
    await driveRequest(
      token,
      driveUrl(DRIVE_API, '/files', {
        spaces: 'appDataFolder',
        q: `name = '${LEDGER_FILENAME}' and trashed = false`,
        pageSize: '1',
        fields: 'files(id)',
      }),
    )
  ).json()) as { files?: unknown[] };
  const first = data.files?.[0];
  return isRecord(first) && typeof first.id === 'string' ? first.id : undefined;
}

export async function readLedger(token: string): Promise<ShareLedger> {
  const fileId = await findLedgerFileId(token);
  if (!fileId) return defaultLedger();

  const res = await driveRequest(
    token,
    driveUrl(DRIVE_API, `/files/${encodeURIComponent(fileId)}`, { alt: 'media' }),
  );
  const parsed: unknown = await res.json().catch(() => undefined);
  return validateLedger(parsed) ? parsed : defaultLedger();
}

export async function writeLedger(token: string, l: ShareLedger): Promise<ShareLedger> {
  const content = JSON.stringify(l);
  const fileId = await findLedgerFileId(token);

  if (fileId) {
    await driveRequest(
      token,
      driveUrl(DRIVE_UPLOAD_API, `/files/${encodeURIComponent(fileId)}`, {
        uploadType: 'media',
        fields: 'id',
      }),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      },
    );
    return l;
  }

  const boundary = `dst-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: LEDGER_FILENAME, parents: ['appDataFolder'] });
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--\r\n`;

  await driveRequest(
    token,
    driveUrl(DRIVE_UPLOAD_API, '/files', { uploadType: 'multipart', fields: 'id' }),
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );

  return l;
}

export async function listPermissions(
  token: string,
  fileId: string,
): Promise<Array<{ id: string; type: string; role: string; emailAddress?: string }>> {
  const data = (await (
    await driveRequest(
      token,
      driveUrl(DRIVE_API, `/files/${encodeURIComponent(fileId)}/permissions`, {
        fields: 'permissions(id,type,role,emailAddress)',
        pageSize: '100',
      }),
    )
  ).json()) as { permissions?: unknown[] };

  const out: Array<{ id: string; type: string; role: string; emailAddress?: string }> = [];
  for (const raw of data.permissions ?? []) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string' || typeof raw.type !== 'string' || typeof raw.role !== 'string') {
      continue;
    }
    out.push({
      id: raw.id,
      type: raw.type,
      role: raw.role,
      ...(typeof raw.emailAddress === 'string' ? { emailAddress: raw.emailAddress } : {}),
    });
  }
  return out;
}

export async function hasAnyonePermission(token: string, fileId: string): Promise<boolean> {
  const perms = await listPermissions(token, fileId);
  return perms.some((p) => p.type === 'anyone');
}

export async function createAnyonePermission(
  token: string,
  fileId: string,
): Promise<{ permissionId: string }> {
  const data = (await (
    await driveRequest(
      token,
      driveUrl(DRIVE_API, `/files/${encodeURIComponent(fileId)}/permissions`, { fields: 'id' }),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      },
    )
  ).json()) as { id?: string };
  if (!data.id) throw new DriveError(502, 'Drive did not return a permission id');
  return { permissionId: data.id };
}

export async function createEmailPermission(
  token: string,
  fileId: string,
  opts: { email: string; notify: boolean; message?: string; expiresAt: string | null },
): Promise<{ permissionId: string; nativeExpiry: boolean }> {
  const email = opts.email.trim();
  if (!email) throw new DriveError(400, 'email is required for share mode "email"');

  const params: Record<string, string | undefined> = {
    sendNotificationEmail: opts.notify ? 'true' : 'false',
    fields: 'id,expirationTime',
  };
  const cleaned = opts.message ? sanitizeMessage(opts.message) : '';
  if (opts.notify && cleaned) params.emailMessage = cleaned;

  const body: Record<string, string> = {
    role: 'reader',
    type: 'user',
    emailAddress: email,
  };

  const post = async (withExpiry: boolean) => {
    const payload = withExpiry && opts.expiresAt ? { ...body, expirationTime: opts.expiresAt } : body;
    const res = await driveRequest(
      token,
      driveUrl(DRIVE_API, `/files/${encodeURIComponent(fileId)}/permissions`, params),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return (await res.json()) as { id?: string; expirationTime?: string };
  };

  try {
    const data = await post(Boolean(opts.expiresAt));
    if (!data.id) throw new DriveError(502, 'Drive did not return a permission id');
    return { permissionId: data.id, nativeExpiry: Boolean(data.expirationTime) };
  } catch (e) {
    const retryable =
      Boolean(opts.expiresAt) &&
      e instanceof DriveError &&
      e.status === 400 &&
      e.message.toLowerCase().includes('expirationtime');
    if (!retryable) throw e;
    const data = await post(false);
    if (!data.id) throw new DriveError(502, 'Drive did not return a permission id');
    return { permissionId: data.id, nativeExpiry: false };
  }
}

export async function patchPermissionExpiry(
  token: string,
  fileId: string,
  permissionId: string,
  expiresAt: string | null,
): Promise<void> {
  await driveRequest(
    token,
    driveUrl(
      DRIVE_API,
      `/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`,
      { fields: 'id,expirationTime' },
    ),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationTime: expiresAt }),
    },
  );
}

/**
 * One of the two permitted Drive DELETE call sites (the other is
 * `deleteAppDataFiles` in appdata.ts). Takes a ledger entry, never a raw id,
 * and targets `permissions/{id}` only — never a file.
 */
export async function revokePermission(
  token: string,
  entry: ShareEntry,
): Promise<'revoked' | 'already-gone'> {
  if (entry.kind === 'external' || !entry.permissionId) {
    throw new DriveError(
      400,
      entry.kind === 'external' ? 'cannot revoke an external share' : 'permissionId is required',
    );
  }

  try {
    await driveRequest(
      token,
      driveUrl(
        DRIVE_API,
        `/files/${encodeURIComponent(entry.fileId)}/permissions/${encodeURIComponent(entry.permissionId)}`,
        {},
      ),
      { method: 'DELETE' },
    );
    return 'revoked';
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return 'already-gone';
    throw e;
  }
}

function needsAppRevoke(entry: ShareEntry): boolean {
  if (entry.kind === 'anyone') return true;
  if (entry.kind === 'copy' && entry.shareKind === 'anyone') return true;
  if (entry.kind === 'email' || (entry.kind === 'copy' && entry.shareKind === 'email')) {
    return entry.nativeExpiry !== true;
  }
  return false;
}

function isGoogleExpiry(entry: ShareEntry): boolean {
  if (entry.kind === 'email' || (entry.kind === 'copy' && entry.shareKind === 'email')) {
    return entry.nativeExpiry === true;
  }
  return false;
}

export async function sweep(
  token: string,
  now?: Date,
): Promise<{ ledger: ShareLedger; revoked: number; expired: number; failed: number }> {
  const when = now ?? new Date();
  const nowIso = when.toISOString();
  const nowMs = when.getTime();

  const ledger = await readLedger(token);
  const previousSweepAt = ledger.lastSweepAt;
  let revoked = 0;
  let expired = 0;
  let failed = 0;
  let changed = false;

  const shares = [...ledger.shares];
  const touched: ShareEntry[] = [];
  for (let i = 0; i < shares.length; i++) {
    const entry = shares[i];
    if (entry.status !== 'active' || entry.expiresAt === null) continue;
    if (Date.parse(entry.expiresAt) > nowMs) continue;

    if (isGoogleExpiry(entry)) {
      shares[i] = {
        ...entry,
        status: 'expired',
        revokedAt: nowIso,
        revokedBy: 'google',
      };
      touched.push(shares[i]);
      expired += 1;
      changed = true;
      continue;
    }

    if (!needsAppRevoke(entry)) continue;

    try {
      await revokePermission(token, entry);
      shares[i] = {
        ...entry,
        status: 'expired',
        revokedAt: nowIso,
        revokedBy: 'sweep',
      };
      touched.push(shares[i]);
      revoked += 1;
      changed = true;
    } catch {
      failed += 1;
    }
  }

  const movedByMoreThan10Min =
    !previousSweepAt || Math.abs(nowMs - Date.parse(previousSweepAt)) > SWEEP_WRITE_MIN_MS;

  if (changed || movedByMoreThan10Min) {
    // Only the entries this sweep changed are merged; untouched entries keep
    // whatever the stored ledger says, so a concurrent revoke or extend is not
    // overwritten by this sweep's stale snapshot.
    const written = await mergeWriteLedger(token, touched, nowIso);
    return { ledger: written, revoked, expired, failed };
  }

  return { ledger, revoked, expired, failed };
}
