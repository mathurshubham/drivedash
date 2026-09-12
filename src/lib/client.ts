import type {
  AccessMeResponse,
  AccessRequest,
  AdminUsersResponse,
  ApiError,
  CopyResponse,
  DownloadFormat,
  DriveFile,
  HotList,
  SearchResponse,
  SearchType,
  ShareMode,
  ShareResponse,
} from '@/lib/types';

export interface ShareBody {
  mode: 'anyone' | 'email';
  email?: string;
}

export interface CopyBody {
  clientName: string;
  share: ShareMode;
  email?: string;
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string'
  );
}

/** Set once a 401 has scheduled the sign-in redirect, so parallel requests do not stack navigations. */
let redirecting = false;

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
    if (typeof window !== 'undefined' && !redirecting) {
      redirecting = true;
      // Defer past the current microtask queue so the rejection below reaches the
      // caller's `.catch` before the page is torn down. The guard keeps parallel
      // requests from each scheduling their own navigation.
      setTimeout(() => {
        // A hard navigation is intentional: the session is gone, so every piece of
        // client state should be discarded rather than soft-navigated around.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }, 0);
    }
    throw new Error('unauthorized');
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

export function shareFile(id: string, body: ShareBody): Promise<ShareResponse> {
  return request<ShareResponse>(`/api/files/${encodeURIComponent(id)}/share`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function copyForClient(id: string, body: CopyBody): Promise<CopyResponse> {
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

export function getAccessMe(): Promise<AccessMeResponse> {
  return request<AccessMeResponse>('/api/access/me');
}

export function requestAccess(note?: string): Promise<{ request: AccessRequest }> {
  return request<{ request: AccessRequest }>('/api/access/request', {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export function getAdminUsers(): Promise<AdminUsersResponse> {
  return request<AdminUsersResponse>('/api/admin/users');
}

export function addAdminUser(email: string): Promise<{ allowlist: string[] }> {
  return request<{ allowlist: string[] }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function removeAdminUser(email: string): Promise<{ allowlist: string[] }> {
  return request<{ allowlist: string[] }>(`/api/admin/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

export function decideAccessRequest(
  email: string,
  decision: 'approved' | 'declined',
): Promise<{ request: AccessRequest; allowlist: string[] }> {
  return request<{ request: AccessRequest; allowlist: string[] }>(
    `/api/admin/requests/${encodeURIComponent(email)}`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    },
  );
}
