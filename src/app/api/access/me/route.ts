import { findPending, getRequests, isAdminEmail, isAllowed } from '@/lib/access';
import { handleError, json, requireSession } from '@/lib/api';

export async function GET(req: Request): Promise<Response> {
  try {
    const { email } = await requireSession(req);
    const [allowed, requests] = await Promise.all([isAllowed(email), getRequests()]);
    return json({
      email,
      allowed,
      isAdmin: isAdminEmail(email),
      pendingRequest: findPending(requests, email),
    });
  } catch (e) {
    return handleError(e);
  }
}
