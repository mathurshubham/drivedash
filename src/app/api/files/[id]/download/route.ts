import { badRequest, handleError, requireToken } from '@/lib/api';
import { downloadFile } from '@/lib/drive';
import type { DownloadFormat } from '@/lib/types';

const FORMATS: readonly DownloadFormat[] = ['native', 'pdf'];

/** Build a Content-Disposition value that is safe for byte-oriented headers. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { token } = await requireToken(req);
    const { id } = await params;
    if (!id) return badRequest('id is required');

    const rawFormat = new URL(req.url).searchParams.get('format') ?? 'native';
    if (!FORMATS.includes(rawFormat as DownloadFormat)) return badRequest('invalid format');

    const { body, contentType, filename } = await downloadFile(
      token,
      id,
      rawFormat as DownloadFormat,
    );

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition(filename),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
