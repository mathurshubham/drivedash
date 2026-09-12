import { addToAllowlist, adminEmails, getAllowlist, getRequests } from '@/lib/access';
import { ApiHttpError, handleError, json, requireAdmin } from '@/lib/api';

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);
    const [allowlist, requests] = await Promise.all([getAllowlist(), getRequests()]);
    return json({ admins: adminEmails(), allowlist, requests });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { email: by } = await requireAdmin(req);
    let email: unknown;
    try {
      email = ((await req.json()) as { email?: unknown }).email;
    } catch {
      throw new ApiHttpError(400, 'invalid email');
    }
    if (typeof email !== 'string') throw new ApiHttpError(400, 'invalid email');
    const allowlist = await addToAllowlist(email, by);
    return json({ allowlist });
  } catch (e) {
    return handleError(e);
  }
}
