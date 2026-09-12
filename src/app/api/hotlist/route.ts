import { badRequest, handleError, json, requireToken } from '@/lib/api';
import { readHotList, validateHotList, writeHotList } from '@/lib/drive';
import type { HotList } from '@/lib/types';

export async function GET(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    return json<HotList>(await readHotList(token));
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const body: unknown = await req.json().catch(() => undefined);
    if (!validateHotList(body)) return badRequest('invalid hot list payload');
    return json<HotList>(await writeHotList(token, body));
  } catch (e) {
    return handleError(e);
  }
}
