import { handleError, json, requireToken } from '@/lib/api';
import { recentFiles } from '@/lib/drive';

export async function GET(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    return json(await recentFiles(token));
  } catch (e) {
    return handleError(e);
  }
}
