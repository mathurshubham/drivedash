import { handleError, badRequest, json, requireToken } from '@/lib/api';
import { getFile } from '@/lib/drive';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const { id } = await params;
    if (!id) return badRequest('id is required');
    return json(await getFile(token, id));
  } catch (e) {
    return handleError(e);
  }
}
