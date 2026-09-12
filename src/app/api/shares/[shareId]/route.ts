import { badRequest, errorResponse, handleError, json, requireToken } from '@/lib/api';
import { patchPermissionExpiry, pruneLedger, readLedger, revokePermission, writeLedger } from '@/lib/shares';
import type { ShareEntry } from '@/lib/types';

const EXTEND_DAYS = 7;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ shareId: string }> },
): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const { shareId } = await params;
    if (!shareId) return badRequest('shareId is required');

    const ledger = await readLedger(token);
    const index = ledger.shares.findIndex((s) => s.id === shareId);
    if (index < 0) return errorResponse(404, 'not found');

    const entry = ledger.shares[index];
    if (entry.kind === 'external' || entry.status === 'private' || entry.status !== 'active') {
      return badRequest('share cannot be revoked');
    }

    const outcome = await revokePermission(token, entry);
    const now = new Date().toISOString();
    const next: ShareEntry = {
      ...entry,
      status: 'revoked',
      revokedAt: now,
      revokedBy: 'you',
      ...(outcome === 'already-gone' ? { note: 'file no longer exists' } : {}),
    };

    const shares = [...ledger.shares];
    shares[index] = next;
    await writeLedger(token, pruneLedger({ ...ledger, shares }));

    return json<{ entry: ShareEntry }>({ entry: next });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ shareId: string }> },
): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const { shareId } = await params;
    if (!shareId) return badRequest('shareId is required');

    const body: unknown = await req.json().catch(() => undefined);
    if (typeof body !== 'object' || body === null) return badRequest('invalid body');
    const { extendDays } = body as { extendDays?: unknown };
    if (extendDays !== EXTEND_DAYS) return badRequest('extendDays must be 7');

    const ledger = await readLedger(token);
    const index = ledger.shares.findIndex((s) => s.id === shareId);
    if (index < 0) return errorResponse(404, 'not found');

    const entry = ledger.shares[index];
    if (entry.status !== 'active' || entry.expiresAt === null) {
      return badRequest('share cannot be extended');
    }

    const nowMs = Date.now();
    const base = Math.max(nowMs, Date.parse(entry.expiresAt));
    const expiresAt = new Date(base + EXTEND_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const emailLike =
      entry.kind === 'email' || (entry.kind === 'copy' && entry.shareKind === 'email');
    if (emailLike && entry.nativeExpiry && entry.permissionId) {
      await patchPermissionExpiry(token, entry.fileId, entry.permissionId, expiresAt);
    }

    const next: ShareEntry = { ...entry, expiresAt };
    const shares = [...ledger.shares];
    shares[index] = next;
    await writeLedger(token, pruneLedger({ ...ledger, shares }));

    return json<{ entry: ShareEntry }>({ entry: next });
  } catch (e) {
    return handleError(e);
  }
}
