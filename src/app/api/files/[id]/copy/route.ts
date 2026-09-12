import { badRequest, handleError, json, requireToken } from '@/lib/api';
import { copyForClient, readHotList, sanitizeClientName, writeHotList } from '@/lib/drive';
import { expiryToDate, mergeWriteLedger, sanitizeMessage } from '@/lib/shares';
import type { CopyResponse, ExpiryDays, ShareEntry, ShareMode } from '@/lib/types';

const SHARE_MODES: readonly ShareMode[] = ['anyone', 'email', 'none'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseExpiresInDays(value: unknown): ExpiryDays | 'invalid' {
  if (value === undefined) return 3;
  if (value === null) return null;
  if (value === 1 || value === 3 || value === 7) return value;
  return 'invalid';
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const { id } = await params;
    if (!id) return badRequest('id is required');

    const body: unknown = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null) return badRequest('invalid body');
    const { clientName, share, email, notify, message, expiresInDays } = body as {
      clientName?: unknown;
      share?: unknown;
      email?: unknown;
      notify?: unknown;
      message?: unknown;
      expiresInDays?: unknown;
    };

    if (typeof clientName !== 'string') return badRequest('clientName is required');
    const name = sanitizeClientName(clientName);
    if (!name) return badRequest('clientName is required');
    if (name.length > 80) return badRequest('clientName must be 80 characters or fewer');

    if (typeof share !== 'string' || !SHARE_MODES.includes(share as ShareMode)) {
      return badRequest('share must be "anyone", "email" or "none"');
    }

    if (notify !== undefined && typeof notify !== 'boolean') {
      return badRequest('notify must be a boolean');
    }
    const notifyFlag = notify !== false;

    if (message !== undefined && typeof message !== 'string') {
      return badRequest('message must be a string');
    }
    const cleaned = typeof message === 'string' ? sanitizeMessage(message) : '';

    const days = parseExpiresInDays(expiresInDays);
    if (days === 'invalid') return badRequest('expiresInDays must be 1, 3, 7 or null');
    const expiresAt = share === 'none' ? null : expiryToDate(days);
    const createdAt = new Date().toISOString();

    let emailAddress: string | undefined;
    if (share === 'email') {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return badRequest('a valid email is required for share mode "email"');
      }
      emailAddress = email.trim();
    }

    const hotlist = await readHotList(token);
    const result = await copyForClient(
      token,
      id,
      {
        clientName: name,
        share: share as ShareMode,
        ...(emailAddress ? { email: emailAddress } : {}),
        notify: notifyFlag,
        ...(cleaned ? { message: cleaned } : {}),
        expiresAt,
      },
      hotlist,
    );

    // Re-read immediately before writing: the copy above is slow enough for a
    // concurrent hot list PUT to have landed, and only the folder id is ours to
    // change here.
    const fresh = await readHotList(token);
    if (fresh.settings.clientSharesFolderId !== result.clientSharesFolderId) {
      await writeHotList(token, {
        ...fresh,
        settings: { ...fresh.settings, clientSharesFolderId: result.clientSharesFolderId },
      });
    }

    const entry: ShareEntry = {
      id: crypto.randomUUID(),
      kind: 'copy',
      status:
        share === 'none' ? 'private' : result.preExisting ? 'external' : 'active',
      fileId: result.file.id,
      fileName: result.file.name,
      webViewLink: result.file.webViewLink,
      ...(result.permissionId ? { permissionId: result.permissionId } : {}),
      ...(emailAddress ? { email: emailAddress } : {}),
      ...(share === 'email' ? { notified: notifyFlag } : {}),
      ...(share === 'email' && cleaned ? { message: cleaned } : {}),
      ...(share === 'email' ? { nativeExpiry: result.nativeExpiry === true } : {}),
      copyOf: id,
      clientName: name,
      shareKind: share as ShareMode,
      createdAt,
      expiresAt,
    };

    await mergeWriteLedger(token, [entry]);

    return json<CopyResponse>({ file: result.file, link: result.link, entry });
  } catch (e) {
    return handleError(e);
  }
}
