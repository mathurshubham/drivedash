/**
 * `DELETE /api/account` — "Delete my data".
 *
 * Four steps, each reported in `steps` whether it worked or not. The response
 * is `200` even when a step failed: partial deletion is the truth the user
 * needs to see, and a 500 would hide which half went through. `401` is the only
 * failure status, and only when there is no usable session at all.
 *
 * Order matters. Shares are revoked *first*, while the Drive token and the
 * ledger that names the permissions are both still usable — deleting
 * `shares.json` first would strand every live link with no record of it. The
 * Google grant is revoked *last*, because it invalidates the token every
 * earlier step needs.
 */
import { removeUserRecordForSelf } from '@/lib/access';
import { ApiHttpError, handleError, json, requireTokenForDeletion } from '@/lib/api';
import { deleteAppDataFiles, revokeGoogleToken } from '@/lib/appdata';
import { readLedger, revokePermission } from '@/lib/shares';
import type { AccountDeleteResponse, AccountDeleteStep } from '@/lib/types';

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function readBody(req: Request): Promise<{ revokeShares: boolean }> {
  const raw: unknown = await req.json().catch(() => undefined);
  const value =
    typeof raw === 'object' && raw !== null
      ? (raw as { revokeShares?: unknown }).revokeShares
      : undefined;
  // Default on: a user asking to be forgotten means the links too, unless they
  // deliberately unticked the box.
  return { revokeShares: value === undefined ? true : value !== false };
}

export async function DELETE(req: Request): Promise<Response> {
  let token: string;
  let email: string;
  let refreshToken: string | undefined;

  try {
    const session = await requireTokenForDeletion(req);
    token = session.token;
    email = session.email;
    refreshToken = session.claims.refreshToken;
  } catch (e) {
    // Only the auth failure is allowed to produce a non-200.
    return handleError(e instanceof ApiHttpError ? e : new ApiHttpError(401, 'unauthorized'));
  }

  const { revokeShares } = await readBody(req);
  const steps: AccountDeleteStep[] = [];

  // (a) Revoke every share we still believe is live.
  if (revokeShares) {
    try {
      const ledger = await readLedger(token);
      const live = ledger.shares.filter(
        (entry) =>
          entry.status === 'active' &&
          Boolean(entry.permissionId) &&
          (entry.kind === 'anyone' || entry.kind === 'email' || entry.kind === 'copy'),
      );
      let failed = 0;
      for (const entry of live) {
        // `revokePermission` already folds Drive's 404 into 'already-gone'.
        try {
          await revokePermission(token, entry);
        } catch {
          failed += 1;
        }
      }
      steps.push({
        step: 'revokeShares',
        ok: failed === 0,
        detail: `${live.length - failed} of ${live.length} revoked`,
      });
    } catch (e) {
      steps.push({ step: 'revokeShares', ok: false, detail: describe(e) });
    }
  }

  // (b) Delete hotlist.json and shares.json from the hidden app-data folder.
  try {
    const results = await deleteAppDataFiles(token);
    const bad = results.filter((r) => !r.ok);
    steps.push({
      step: 'appDataFiles',
      ok: bad.length === 0,
      ...(bad.length ? { detail: bad.map((r) => `${r.name}: ${r.detail ?? 'failed'}`).join('; ') } : {}),
    });
  } catch (e) {
    steps.push({ step: 'appDataFiles', ok: false, detail: describe(e) });
  }

  // (c) Give the registry seat back.
  try {
    const outcome = await removeUserRecordForSelf(email);
    steps.push({
      step: 'registry',
      ok: true,
      ...(outcome === 'removed' ? {} : { detail: outcome === 'admin' ? 'admin account' : 'no record' }),
    });
  } catch (e) {
    steps.push({ step: 'registry', ok: false, detail: describe(e) });
  }

  // (d) Hand the grant back to Google. The refresh token is the one that
  // actually removes the app's access; the access token only cuts this session
  // short. Revoke both when both exist.
  const revocations = await Promise.all(
    [refreshToken, token].filter((t): t is string => Boolean(t)).map((t) => revokeGoogleToken(t)),
  );
  const failedRevocations = revocations.filter((r) => !r.ok);
  steps.push({
    step: 'googleAccess',
    ok: failedRevocations.length === 0,
    ...(failedRevocations.length
      ? { detail: failedRevocations.map((r) => r.detail ?? 'failed').join('; ') }
      : {}),
  });

  return json<AccountDeleteResponse>({ steps });
}
