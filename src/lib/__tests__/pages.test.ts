/**
 * Branding pages must bypass the auth proxy. The matcher negative lookahead
 * excludes `/about`, `/privacy`, and `/terms`; prefix paths like `/apifoo`
 * must still be protected.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => vi.fn()),
  isAllowedEmail: vi.fn(),
}));

const { config } = await import('@/proxy');

/** Mirrors Next.js middleware matching for our single anchored matcher pattern. */
function matchesProxyMatcher(pathname: string): boolean {
  const pattern = config.matcher[0];
  const regexp = new RegExp(`^${pattern}$`);
  return regexp.test(pathname);
}

describe('proxy config.matcher', () => {
  it('does not match public branding pages', () => {
    expect(matchesProxyMatcher('/about')).toBe(false);
    expect(matchesProxyMatcher('/privacy')).toBe(false);
    expect(matchesProxyMatcher('/terms')).toBe(false);
  });

  it('still matches protected page routes', () => {
    expect(matchesProxyMatcher('/')).toBe(true);
    expect(matchesProxyMatcher('/shares')).toBe(true);
    expect(matchesProxyMatcher('/apifoo')).toBe(true);
  });
});
