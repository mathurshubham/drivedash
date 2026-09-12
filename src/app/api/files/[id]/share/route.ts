import { badRequest, handleError, json, requireToken } from '@/lib/api';
import { shareFile } from '@/lib/drive';
import type { ShareResponse } from '@/lib/types';

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
    const { mode, email } = body as { mode?: unknown; email?: unknown };

    if (mode !== 'anyone' && mode !== 'email') return badRequest('mode must be "anyone" or "email"');

    if (mode === 'email') {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return badRequest('a valid email is required for mode "email"');
      }
      const result = await shareFile(token, id, { mode, email: email.trim() });
      return json<ShareResponse>(result);
    }

    return json<ShareResponse>(await shareFile(token, id, { mode }));
  } catch (e) {
    return handleError(e);
  }
}
