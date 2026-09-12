import { describe, expect, it } from 'vitest';

import {
  SHELF_COLORS,
  SHELF_ICONS,
  SHELF_ICON_COMPONENTS,
  shelfColor,
  shelfIcon,
} from '@/components/shelves/style';

describe('shelfColor', () => {
  it('keeps an explicit colour', () => {
    expect(shelfColor('rose', 0)).toBe('rose');
  });

  it('falls back to the hue for the shelf position', () => {
    expect(shelfColor(undefined, 0)).toBe(SHELF_COLORS[0]);
    expect(shelfColor(undefined, 3)).toBe(SHELF_COLORS[3]);
  });

  it('wraps round the palette rather than running out', () => {
    expect(shelfColor(undefined, SHELF_COLORS.length)).toBe(SHELF_COLORS[0]);
    expect(shelfColor(undefined, SHELF_COLORS.length + 2)).toBe(SHELF_COLORS[2]);
  });
});

describe('shelfIcon', () => {
  it('defaults to the folder glyph', () => {
    expect(shelfIcon(undefined)).toBe('folder');
  });

  it('keeps an explicit icon', () => {
    expect(shelfIcon('rocket')).toBe('rocket');
  });
});

describe('shelf palette', () => {
  it('offers eight hues and eight glyphs', () => {
    expect(SHELF_COLORS).toHaveLength(8);
    expect(SHELF_ICONS).toHaveLength(8);
  });

  it('has a component for every icon name', () => {
    for (const icon of SHELF_ICONS) expect(SHELF_ICON_COMPONENTS[icon]).toBeTruthy();
  });
});
