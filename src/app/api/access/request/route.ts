import { getRequests, isAllowed, upsertRequest } from '@/lib/access';
import { ApiHttpError, handleError, json, requireSession } from '@/lib/api';

const RATE_LIMIT_MS = 10 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, name } = await requireSession(req);
    if (await isAllowed(email)) throw new ApiHttpError(409, 'already allowed');

    let note: string | undefined;
    try {
      const body = (await req.json()) as { note?: unknown };
      if (body.note !== undefined && typeof body.note !== 'string') {
        throw new ApiHttpError(400, 'invalid note');
      }
      note = typeof body.note === 'string' ? body.note : undefined;
    } catch (e) {
      if (e instanceof ApiHttpError) throw e;
      // empty / invalid JSON is treated as no note
    }

    const items = await getRequests();
    const latest = items
      .filter((i) => i.email === email)
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))[0];
    // One write per email per 10 minutes (compare requestedAt).
    if (latest && Date.now() - Date.parse(latest.requestedAt) < RATE_LIMIT_MS) {
      throw new ApiHttpError(429, 'rate limited');
    }

    const request = await upsertRequest({ email, name, note });
    return json({ request });
  } catch (e) {
    return handleError(e);
  }
}
