import {
  BookOpen,
  Briefcase,
  FileText,
  Folder,
  Layers,
  Presentation,
  Rocket,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { SHELF_COLORS, SHELF_ICONS, type ShelfColor, type ShelfIcon } from '@/lib/types';

export { SHELF_COLORS, SHELF_ICONS };
export type { ShelfColor, ShelfIcon };

/** Partial shelf identity: only the fields the caller actually picked. */
export interface ShelfStyle {
  color?: ShelfColor;
  icon?: ShelfIcon;
}

export const SHELF_ICON_COMPONENTS: Record<ShelfIcon, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  presentation: Presentation,
  'file-text': FileText,
  layers: Layers,
  star: Star,
  rocket: Rocket,
  'book-open': BookOpen,
};

export const SHELF_ICON_LABEL: Record<ShelfIcon, string> = {
  folder: 'Folder',
  briefcase: 'Briefcase',
  presentation: 'Presentation',
  'file-text': 'Document',
  layers: 'Layers',
  star: 'Star',
  rocket: 'Rocket',
  'book-open': 'Book',
};

export const SHELF_COLOR_LABEL: Record<ShelfColor, string> = {
  slate: 'Slate',
  blue: 'Blue',
  violet: 'Violet',
  rose: 'Rose',
  amber: 'Amber',
  emerald: 'Emerald',
  teal: 'Teal',
  orange: 'Orange',
};

/**
 * A shelf with no stored colour takes one from its position, so a fresh hot
 * list still looks deliberate rather than eight identical grey cards.
 */
export function shelfColor(color: ShelfColor | undefined, index: number): ShelfColor {
  return color ?? SHELF_COLORS[index % SHELF_COLORS.length];
}

export function shelfIcon(icon: ShelfIcon | undefined): ShelfIcon {
  return icon ?? 'folder';
}

/** How many tiles a shelf shows before the "+N more" tile takes over. */
export const SHELF_PREVIEW_COUNT = 6;
