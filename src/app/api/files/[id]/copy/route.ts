import { badRequest, handleError, json, requireToken } from '@/lib/api';
import { copyForClient, readHotList, sanitizeClientName, writeHotList } from '@/lib/drive';
import type { CopyResponse, ShareMode } from '@/lib/types';

const SHARE_MODES: readonly ShareMode[] = ['anyone', 'email', 'none'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const { clientName, share, email } = body as {
      clientName?: unknown;
      share?: unknown;
      email?: unknown;
    };

    if (typeof clientName !== 'string') return badRequest('clientName is required');
    const name = sanitizeClientName(clientName);
    if (!name) return badRequest('clientName is required');
    if (name.length > 80) return badRequest('clientName must be 80 characters or fewer');

    if (typeof share !== 'string' || !SHARE_MODES.includes(share as ShareMode)) {
      return badRequest('share must be "anyone", "email" or "none"');
    }

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

    return json<CopyResponse>({ file: result.file, link: result.link });
  } catch (e) {
    return handleError(e);
  }
}
