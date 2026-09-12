import { removeUser } from '@/lib/access';
import { handleError, json, requireAdmin } from '@/lib/api';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
): Promise<Response> {
  try {
    const { email: by } = await requireAdmin(req);
    const { email: raw } = await params;
    // KV registry only — not a Drive delete. The DELETE guard scans drive.ts / shares.ts.
    const email = decodeURIComponent(raw).trim().toLowerCase();
    const users = await removeUser(email, by);
    return json({ users });
  } catch (e) {
    return handleError(e);
  }
}
