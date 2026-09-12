import type {
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
    if (typeof window !== 'undefined') {
      // A hard navigation is intentional: the session is gone, so every piece of
      // client state should be discarded rather than soft-navigated around.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
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
