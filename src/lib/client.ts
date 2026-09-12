import type {
  AccessMeResponse,
  AdminUsersResponse,
  ApiError,
  CopyRequest,
  CopyResponse,
  DownloadFormat,
  DriveFile,
  HotList,
  KvBudgetInfo,
  SearchResponse,
  SearchType,
  ShareEntry,
  ShareLedger,
  ShareRequest,
  ShareResponse,
  SweepResponse,
  UserRecord,
} from '@/lib/types';

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

/**
 * Set once a 401 (or a 403 from the access gate) has scheduled a navigation, so
 * parallel requests do not stack redirects.
 */
let redirecting = false;

/** A hard navigation: the session or the user's access is gone, so client state should go too. */
function hardNavigate(to: string): void {
  if (typeof window === 'undefined' || redirecting) return;
  redirecting = true;
  // Defer past the current microtask queue so the rejection reaches the caller's
  // `.catch` before the page is torn down.
  setTimeout(() => {
    window.location.href = to;
  }, 0);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : null),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('network_error');
  }

  if (res.status === 401) {
    hardNavigate('/login');
    throw new Error('unauthorized');
  }

  if (res.status === 403) {
    let reason: string | null = null;
    try {
      const body: unknown = await res.clone().json();
      if (isApiError(body) && (body.error === 'full' || body.error === 'blocked')) {
        reason = body.error;
      }
    } catch {
      // fall through to the generic error path below
    }
    if (reason) {
      hardNavigate(`/access-denied?reason=${reason}`);
      throw new Error(reason);
    }
  }

  if (!res.ok) {
    let message = `request_failed_${res.status}`;
    try {
      const body: unknown = await res.json();
      if (isApiError(body)) message = body.error;
    } catch {
      // keep the fallback message
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function search(
  q: string,
  type: SearchType = 'all',
  pageToken?: string,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, type });
  if (pageToken) params.set('pageToken', pageToken);
  return request<SearchResponse>(`/api/search?${params.toString()}`);
}

export function recent(): Promise<SearchResponse> {
  return request<SearchResponse>('/api/recent');
}

export function getFile(id: string): Promise<DriveFile> {
  return request<DriveFile>(`/api/files/${encodeURIComponent(id)}`);
}

/** URL of the download route. Navigate to it (anchor or window.location) to download. */
export function downloadUrl(id: string, format: DownloadFormat = 'native'): string {
  return `/api/files/${encodeURIComponent(id)}/download?format=${format}`;
}

export function shareFile(id: string, body: ShareRequest): Promise<ShareResponse> {
  return request<ShareResponse>(`/api/files/${encodeURIComponent(id)}/share`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function copyForClient(id: string, body: CopyRequest): Promise<CopyResponse> {
  return request<CopyResponse>(`/api/files/${encodeURIComponent(id)}/copy`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getHotList(): Promise<HotList> {
  return request<HotList>('/api/hotlist');
}

export function putHotList(list: HotList): Promise<HotList> {
  return request<HotList>('/api/hotlist', {
    method: 'PUT',
    body: JSON.stringify(list),
  });
}

export function getShares(): Promise<ShareLedger> {
  return request<ShareLedger>('/api/shares');
}

export function sweepShares(): Promise<SweepResponse> {
  return request<SweepResponse>('/api/shares/sweep', { method: 'POST' });
}

export function revokeShare(id: string): Promise<{ entry: ShareEntry }> {
  return request<{ entry: ShareEntry }>(`/api/shares/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function extendShare(id: string, days: 7): Promise<{ entry: ShareEntry }> {
  return request<{ entry: ShareEntry }>(`/api/shares/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ extendDays: days }),
  });
}

export function getAccessMe(): Promise<AccessMeResponse> {
  return request<AccessMeResponse>('/api/access/me');
}

export function getAdminUsers(): Promise<AdminUsersResponse & { budget: KvBudgetInfo }> {
  return request<AdminUsersResponse & { budget: KvBudgetInfo }>('/api/admin/users');
}

export function setUserBlocked(email: string, blocked: boolean): Promise<{ users: UserRecord[] }> {
  return request<{ users: UserRecord[] }>(
    `/api/admin/users/${encodeURIComponent(email)}/block`,
    { method: 'POST', body: JSON.stringify({ blocked }) },
  );
}

export function removeUser(email: string): Promise<{ users: UserRecord[] }> {
  return request<{ users: UserRecord[] }>(`/api/admin/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}
