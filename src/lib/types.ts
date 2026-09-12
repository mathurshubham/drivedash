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
  thumbnailLink?: string;          // Drive thumbnail, when the pinned file had one
  label?: string;                 // optional user override shown instead of name
  pinnedAt?: string;              // ISO time the file was pinned; drives the tile's meta line
}

/**
 * Shelf identity (DESIGN_PLAN §7). Eight muted hues and eight lucide glyphs,
 * both optional on a group: absent means "colour by index, icon `folder`".
 * Const arrays so `validateHotList` can check a stored value without a second
 * source of truth.
 */
export const SHELF_COLORS = [
  'slate',
  'blue',
  'violet',
  'rose',
  'amber',
  'emerald',
  'teal',
  'orange',
] as const;
export type ShelfColor = (typeof SHELF_COLORS)[number];

export const SHELF_ICONS = [
  'folder',
  'briefcase',
  'presentation',
  'file-text',
  'layers',
  'star',
  'rocket',
  'book-open',
] as const;
export type ShelfIcon = (typeof SHELF_ICONS)[number];

export interface HotGroup {
  id: string;                     // crypto.randomUUID()
  name: string;
  items: HotItem[];
  color?: ShelfColor;             // shelf tint; defaults to SHELF_COLORS[index % 8]
  icon?: ShelfIcon;               // shelf glyph; defaults to 'folder'
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
export interface ShareResponse { link: string; entry: ShareEntry }
export interface CopyResponse { file: DriveFile; link: string | null; entry: ShareEntry }
export interface ApiError { error: string }

export type ShareKind = 'anyone' | 'email' | 'copy' | 'external';
export type ShareStatus = 'active' | 'expired' | 'revoked' | 'private' | 'external';
export type RevokedBy = 'you' | 'sweep' | 'google';
export type ExpiryDays = 1 | 3 | 7 | null;

export interface ShareEntry {
  id: string;                 // crypto.randomUUID()
  kind: ShareKind;
  status: ShareStatus;
  fileId: string;             // the file the permission is on (for 'copy', the copy's id)
  fileName: string;
  webViewLink: string;
  permissionId?: string;      // absent for 'external' and for copy with shareKind 'none'
  // email shares
  email?: string;
  notified?: boolean;         // true when Google's notification email was sent
  message?: string;           // the optional message, max 500 chars, stored for the log
  nativeExpiry?: boolean;     // true when Drive accepted expirationTime
  // copy-for-client shares
  copyOf?: string;            // original file id
  clientName?: string;
  shareKind?: ShareMode;      // 'anyone' | 'email' | 'none' — how the copy was shared
  // lifecycle
  createdAt: string;          // ISO
  expiresAt: string | null;   // ISO or null = never
  revokedAt?: string;
  revokedBy?: RevokedBy;
  note?: string;              // e.g. 'file no longer exists'
  fileKind?: FileKind;        // derived from mime when the share was created
}

export interface ShareLedger {
  version: 1;
  lastSweepAt: string | null;
  shares: ShareEntry[];
}

export interface ShareRequest {
  mode: 'anyone' | 'email';
  email?: string;
  notify?: boolean;
  message?: string;
  expiresInDays?: ExpiryDays;
}

export interface CopyRequest {
  clientName: string;
  share: ShareMode;
  email?: string;
  notify?: boolean;
  message?: string;
  expiresInDays?: ExpiryDays;
}

export interface SweepResponse {
  revoked: number;
  expired: number;
  failed: number;
  ledger: ShareLedger;
}

export interface UserRecord {
  email: string;
  name?: string;
  firstSeenAt: string;          // ISO
  lastSeenAt: string;           // ISO
  blocked?: boolean;
}

export interface UsersDoc {
  version: 1;
  users: UserRecord[];
}

export type AccessDecision =
  | { allowed: true; isAdmin: boolean }
  | { allowed: false; reason: 'full' | 'blocked' };

export interface AccessMeResponse {
  email: string;
  allowed: boolean;
  isAdmin: boolean;
  reason?: 'full' | 'blocked';
  maxUsers: number;
}

export interface KvBudgetInfo {
  writesToday: number;
  softLimit: number;
  hardLimit: number;
}

export interface AdminUsersResponse {
  admins: string[];
  maxUsers: number;
  users: UserRecord[];
  budget: KvBudgetInfo;
}
