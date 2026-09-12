import type { DriveFile, ExpiryDays, FileKind, HotItem } from '@/lib/types';

export interface SheetTarget {
  id: string;
  name: string;
  mimeType: string;
  kind: FileKind;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export function targetFromFile(file: DriveFile): SheetTarget {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    kind: file.kind,
    webViewLink: file.webViewLink,
    iconLink: file.iconLink,
    thumbnailLink: file.thumbnailLink,
  };
}

export function targetFromHotItem(item: HotItem): SheetTarget {
  return {
    id: item.fileId,
    name: item.name,
    mimeType: item.mimeType,
    kind: item.kind,
    webViewLink: item.webViewLink,
    iconLink: item.iconLink,
    thumbnailLink: item.thumbnailLink,
  };
}

export function toHotItem(target: SheetTarget): HotItem {
  return {
    fileId: target.id,
    name: target.name,
    mimeType: target.mimeType,
    kind: target.kind,
    webViewLink: target.webViewLink,
    iconLink: target.iconLink,
    thumbnailLink: target.thumbnailLink,
  };
}

export const NATIVE_KINDS: FileKind[] = ['slides', 'docs', 'sheets'];

/**
 * The sheet's sub-views; `menu` is the root. `result` is where every share
 * flow lands on success — it replaces the form rather than stacking on it, so
 * Back from it returns to `menu`.
 */
export type SheetView = 'menu' | 'anyone' | 'email' | 'copy' | 'pin' | 'move' | 'label' | 'result';

export function expiryPhrase(days: ExpiryDays): string {
  if (days === null) return 'no expiry';
  if (days === 1) return 'expires in 1 day';
  return `expires in ${days} days`;
}
