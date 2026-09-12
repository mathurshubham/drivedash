import { blockUser, unblockUser } from '@/lib/access';
import { ApiHttpError, handleError, json, requireAdmin } from '@/lib/api';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
): Promise<Response> {
  try {
    const { email: by } = await requireAdmin(req);
    const { email: raw } = await params;
    const email = decodeURIComponent(raw).trim().toLowerCase();

    let blocked: unknown;
    try {
      blocked = ((await req.json()) as { blocked?: unknown }).blocked;
    } catch {
      throw new ApiHttpError(400, 'invalid blocked');
    }
    if (typeof blocked !== 'boolean') throw new ApiHttpError(400, 'invalid blocked');

    const users = blocked ? await blockUser(email, by) : await unblockUser(email, by);
    return json({ users });
  } catch (e) {
    return handleError(e);
  }
}
