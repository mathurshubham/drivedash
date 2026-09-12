import { auth, getAccessToken } from './auth';
import { DriveError } from './drive';
import type { ApiError } from './types';

export { DriveError };

/** An error that maps directly onto an HTTP status in an API route. */
export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

/** JSON response helper with the correct content type. */
export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function errorResponse(status: number, error: string): Response {
  return json<ApiError>({ error }, { status });
}

/** 400 helper for manual body/query validation. */
export function badRequest(error: string): Response {
  return errorResponse(400, error);
}

/**
 * Resolve the Google access token for the current session.
 * Throws `ApiHttpError(401)` when there is no usable session.
 */
export async function requireToken(req?: Request): Promise<{ token: string }> {
  const session = await auth();
  if (!session?.user || session.error === 'RefreshTokenError') {
    throw new ApiHttpError(401, 'unauthorized');
  }
  const token = await getAccessToken(req);
  if (!token) throw new ApiHttpError(401, 'unauthorized');
  return { token };
}

/** Map any thrown value onto an `ApiError` response. */
export function handleError(e: unknown): Response {
  if (e instanceof ApiHttpError) return errorResponse(e.status, e.message);
  if (e instanceof DriveError) {
    const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
    return errorResponse(status, e.message);
  }
  console.error('Unhandled API error', e);
  return errorResponse(500, 'internal_error');
}
