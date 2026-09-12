import { handleError, json, requireToken } from '@/lib/api';
import { sweep } from '@/lib/shares';
import type { SweepResponse } from '@/lib/types';

export async function POST(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const result = await sweep(token);
    return json<SweepResponse>({
      revoked: result.revoked,
      expired: result.expired,
      failed: result.failed,
      ledger: result.ledger,
    });
  } catch (e) {
    return handleError(e);
  }
}
