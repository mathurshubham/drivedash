/**
 * Accept only same-origin relative paths. Rejects protocol-relative URLs,
 * backslashes, and anything the URL parser would treat as another origin.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, 'https://local.invalid');
  } catch {
    return null;
  }

  if (parsed.origin !== 'https://local.invalid') return null;
  if (parsed.username || parsed.password) return null;

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (parsed.pathname === '/login') return null;
  return path;
}
