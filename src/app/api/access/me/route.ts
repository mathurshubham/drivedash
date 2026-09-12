import { maxUsers, resolveAccess } from '@/lib/access';
import { handleError, json, requireSession } from '@/lib/api';
import type { AccessMeResponse } from '@/lib/types';

/**
 * Session-only identity plus the gate result, so `/access-denied` can explain
 * itself. No Drive token is resolved, so a `RefreshTokenError` session still
 * gets an answer.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { email, name } = await requireSession(req);
    const decision = await resolveAccess(email, name);
    const body: AccessMeResponse = decision.allowed
      ? { email, allowed: true, isAdmin: decision.isAdmin, maxUsers: maxUsers() }
      : { email, allowed: false, isAdmin: false, reason: decision.reason, maxUsers: maxUsers() };
    return json(body);
  } catch (e) {
    return handleError(e);
  }
}
