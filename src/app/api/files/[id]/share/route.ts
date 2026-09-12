import { badRequest, handleError, json, requireToken } from '@/lib/api';
import { shareFile } from '@/lib/drive';
import { expiryToDate, pruneLedger, readLedger, sanitizeMessage, writeLedger } from '@/lib/shares';
import type { ExpiryDays, ShareEntry, ShareResponse } from '@/lib/types';

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
    const { mode, email, notify, message, expiresInDays } = body as {
      mode?: unknown;
      email?: unknown;
      notify?: unknown;
      message?: unknown;
      expiresInDays?: unknown;
    };

    if (mode !== 'anyone' && mode !== 'email') return badRequest('mode must be "anyone" or "email"');

    if (notify !== undefined && typeof notify !== 'boolean') {
      return badRequest('notify must be a boolean');
    }
    const notifyFlag = notify !== false;

    if (message !== undefined && typeof message !== 'string') {
      return badRequest('message must be a string');
    }
    const cleaned = typeof message === 'string' ? sanitizeMessage(message) : '';
    if (typeof message === 'string' && message.trim().length > 0 && cleaned.length === 0) {
      return badRequest('message must be 500 characters or fewer');
    }

    const days = parseExpiresInDays(expiresInDays);
    if (days === 'invalid') return badRequest('expiresInDays must be 1, 3, 7 or null');
    const expiresAt = expiryToDate(days);
    const createdAt = new Date().toISOString();

    if (mode === 'email') {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return badRequest('a valid email is required for mode "email"');
      }
    }

    const result = await shareFile(token, id, {
      mode,
      ...(mode === 'email' && typeof email === 'string' ? { email: email.trim() } : {}),
      notify: notifyFlag,
      ...(cleaned ? { message: cleaned } : {}),
      expiresAt,
    });

    const entry: ShareEntry = result.preExisting
      ? {
          id: crypto.randomUUID(),
          kind: 'external',
          status: 'external',
          fileId: id,
          fileName: result.file.name,
          webViewLink: result.link,
          createdAt,
          expiresAt: null,
        }
      : {
          id: crypto.randomUUID(),
          kind: mode,
          status: 'active',
          fileId: id,
          fileName: result.file.name,
          webViewLink: result.link,
          ...(result.permissionId ? { permissionId: result.permissionId } : {}),
          ...(mode === 'email' && typeof email === 'string' ? { email: email.trim() } : {}),
          ...(mode === 'email' ? { notified: notifyFlag } : {}),
          ...(mode === 'email' && cleaned ? { message: cleaned } : {}),
          ...(mode === 'email' ? { nativeExpiry: result.nativeExpiry === true } : {}),
          createdAt,
          expiresAt,
        };

    const ledger = await readLedger(token);
    await writeLedger(token, pruneLedger({ ...ledger, shares: [...ledger.shares, entry] }));

    return json<ShareResponse>({ link: result.link, entry });
  } catch (e) {
    return handleError(e);
  }
}
