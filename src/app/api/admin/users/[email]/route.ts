import { removeFromAllowlist } from '@/lib/access';
import { handleError, json, requireAdmin } from '@/lib/api';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
): Promise<Response> {
  try {
    const { email: by } = await requireAdmin(req);
    const { email: raw } = await params;
    // KV allowlist only — not a Drive delete. The DELETE guard scans drive.ts / shares.ts.
    const email = decodeURIComponent(raw).trim().toLowerCase();
    const allowlist = await removeFromAllowlist(email, by);
    return json({ allowlist });
  } catch (e) {
    return handleError(e);
  }
}
