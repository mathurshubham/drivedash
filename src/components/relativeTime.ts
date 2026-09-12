/** Compact relative time ("just now", "5m ago", "2h ago", "3d ago"). No date library. */
export function relativeTime(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 45) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.round(days / 7);
  if (days < 30) return `${weeks}w ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(days / 365)}y ago`;
}

/** Compact future time ("in 2d", "in 5h", "today", "expired"). */
export function relativeFuture(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'no expiry';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const ms = then - now;
  if (ms <= 0) return 'expired';

  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) return 'today';
  if (hours < 24) return `in ${hours}h`;

  const days = Math.round(hours / 24);
  return `in ${days}d`;
}
