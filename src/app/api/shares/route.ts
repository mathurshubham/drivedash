import { handleError, json, requireToken } from '@/lib/api';
import { readLedger } from '@/lib/shares';
import type { ShareLedger } from '@/lib/types';

export async function GET(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    return json<ShareLedger>(await readLedger(token));
  } catch (e) {
    return handleError(e);
  }
}
