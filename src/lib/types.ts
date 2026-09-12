export type FileKind = 'slides' | 'docs' | 'sheets' | 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'folder' | 'other';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  kind: FileKind;                 // derived server-side from mimeType
  modifiedTime: string;           // ISO
  viewedByMeTime?: string;        // ISO
  size?: number;                  // bytes, absent for Google-native
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink: string;
}

export interface HotItem {
  fileId: string;
  name: string;
  mimeType: string;
  kind: FileKind;
  webViewLink: string;
  iconLink?: string;
  label?: string;                 // optional user override shown instead of name
}

export interface HotGroup {
  id: string;                     // crypto.randomUUID()
  name: string;
  items: HotItem[];
}

export interface HotList {
  version: 1;
  groups: HotGroup[];
  settings: {
    clientSharesFolderId?: string;   // cached id of "Client Shares" root folder
  };
}

export type SearchType = 'all' | 'slides' | 'docs' | 'sheets' | 'pdf' | 'pptx' | 'docx' | 'xlsx';
export type ShareMode = 'anyone' | 'email' | 'none';
export type DownloadFormat = 'native' | 'pdf';

export interface SearchResponse { files: DriveFile[]; nextPageToken?: string }
export interface ShareResponse { link: string }
export interface CopyResponse { file: DriveFile; link: string | null }
export interface ApiError { error: string }

export interface AccessRequest {
  email: string;
  name?: string;
  note?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'declined';
  decidedAt?: string;
  decidedBy?: string;
}

export interface AccessMeResponse {
  email: string;
  allowed: boolean;
  isAdmin: boolean;
  pendingRequest: AccessRequest | null;
}

export interface AdminUsersResponse {
  admins: string[];
  allowlist: string[];
  requests: AccessRequest[];
}
