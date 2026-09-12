import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../safe-next';

describe('safeNextPath', () => {
  it('accepts relative same-origin paths', () => {
    expect(safeNextPath('/admin/users')).toBe('/admin/users');
    expect(safeNextPath('/foo?bar=1')).toBe('/foo?bar=1');
    expect(safeNextPath('/x#y')).toBe('/x#y');
  });

  it('rejects open redirects', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('evil.example')).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });

  it('rejects /login to avoid a bounce loop', () => {
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/login?error=AccessDenied')).toBeNull();
  });
});
