import { handleError, badRequest, json, requireToken } from '@/lib/api';
import { searchFiles } from '@/lib/drive';
import type { SearchType } from '@/lib/types';

const SEARCH_TYPES: readonly SearchType[] = [
  'all',
  'slides',
  'docs',
  'sheets',
  'pdf',
  'pptx',
  'docx',
  'xlsx',
];

export async function GET(req: Request): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const url = new URL(req.url);

    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 1) return badRequest('q is required');

    const rawType = url.searchParams.get('type') ?? 'all';
    if (!SEARCH_TYPES.includes(rawType as SearchType)) return badRequest('invalid type');

    const pageToken = url.searchParams.get('pageToken') ?? undefined;

    return json(await searchFiles(token, { q, type: rawType as SearchType, pageToken }));
  } catch (e) {
    return handleError(e);
  }
}
