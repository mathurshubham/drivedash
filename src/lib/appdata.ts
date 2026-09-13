/**
 * Account deletion primitives: removing this app's own two files from the
 * user's hidden `appDataFolder`, and handing the OAuth grant back to Google.
 *
 * Hard rule 1 (never delete files) is amended, not broken, here: this module is
 * the second — and last — permitted Drive DELETE call site. It may only target
 * an id returned by an `appDataFolder` lookup by name, i.e. `hotlist.json` and
 * `shares.json`, which are private to this app by construction and invisible in
 * the user's Drive. Nothing in My Drive is ever deleted or trashed.
 */
import { DRIVE_API, HOTLIST_FILENAME, driveRequest, driveUrl, findHotListFileId } from './drive';
import { LEDGER_FILENAME, findLedgerFileId } from './shares';

const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export interface AppDataDeletion {
  /** The app-data file name this result is about. */
  name: string;
  ok: boolean;
  detail?: string;
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Delete `hotlist.json` and `shares.json` from `spaces=appDataFolder`.
 *
 * Each file is looked up by name in the app-data space first; the DELETE URL is
 * built from the id that lookup returned and from nothing else. A missing file
 * counts as success — the user simply never wrote one. One failure does not
 * stop the other file: the caller reports whatever did not go through.
 */
export async function deleteAppDataFiles(token: string): Promise<AppDataDeletion[]> {
  const targets = [
    { name: HOTLIST_FILENAME, find: () => findHotListFileId(token) },
    { name: LEDGER_FILENAME, find: () => findLedgerFileId(token) },
  ];

  const results: AppDataDeletion[] = [];
  for (const target of targets) {
    try {
      const fileId = await target.find();
      if (!fileId) {
        results.push({ name: target.name, ok: true, detail: 'not found' });
        continue;
      }
      await driveRequest(token, driveUrl(DRIVE_API, `/files/${encodeURIComponent(fileId)}`, {}), {
        method: 'DELETE',
      });
      results.push({ name: target.name, ok: true });
    } catch (e) {
      results.push({ name: target.name, ok: false, detail: describe(e) });
    }
  }
  return results;
}

/**
 * Hand an OAuth token back to Google. Revoking the *refresh* token is what
 * actually removes the app's access to the account; revoking the access token
 * only shortens the current session. Callers do both when both are available.
 *
 * Never throws: a token Google has already forgotten answers 400, and that is
 * indistinguishable from — and as good as — success. The outcome is reported so
 * the caller can surface it rather than silently claiming the grant is gone.
 */
export async function revokeGoogleToken(token: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    if (!res.ok) return { ok: false, detail: `revoke responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: describe(e) };
  }
}
