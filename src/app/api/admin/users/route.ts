import { adminEmails, listUsers, maxUsers } from '@/lib/access';
import { handleError, json, requireAdmin } from '@/lib/api';
import { budgetSnapshot } from '@/lib/kv-budget';
import type { AdminUsersResponse } from '@/lib/types';

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin(req);
    const users = await listUsers();
    const body: AdminUsersResponse = {
      admins: adminEmails(),
      maxUsers: maxUsers(),
      users,
      budget: budgetSnapshot(),
    };
    return json(body);
  } catch (e) {
    return handleError(e);
  }
}
