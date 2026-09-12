import { decideRequest, getAllowlist } from '@/lib/access';
import { ApiHttpError, handleError, json, requireAdmin } from '@/lib/api';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
): Promise<Response> {
  try {
    const { email: by } = await requireAdmin(req);
    const { email: raw } = await params;
    const email = decodeURIComponent(raw).trim().toLowerCase();

    let decision: unknown;
    try {
      decision = ((await req.json()) as { decision?: unknown }).decision;
    } catch {
      throw new ApiHttpError(400, 'invalid decision');
    }
    if (decision !== 'approved' && decision !== 'declined') {
      throw new ApiHttpError(400, 'invalid decision');
    }

    const request = await decideRequest(email, decision, by);
    const allowlist = await getAllowlist();
    return json({ request, allowlist });
  } catch (e) {
    return handleError(e);
  }
}
