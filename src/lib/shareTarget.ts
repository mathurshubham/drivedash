/**
 * Pure helpers behind the sheet's result view, where a freshly created link is
 * handed on to whatever the phone actually shares with. Node-safe: every
 * environment check is a parameter, never a global read, so the whole module is
 * unit-testable and the callers decide when to look at `navigator`.
 */

/** The body of a share: file name, newline, link. Used by WhatsApp and as the native fallback. */
export function buildShareText(fileName: string, url: string): string {
  return `${fileName}\n${url}`;
}

/** A `wa.me` deep link that pre-fills the message; WhatsApp picks the recipient. */
export function whatsappHref(fileName: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildShareText(fileName, url))}`;
}

/** True when the Web Share API is present, i.e. the OS sheet can be opened. */
export function canNativeShare(nav: Partial<Navigator> | null | undefined): boolean {
  return typeof nav?.share === 'function';
}

/**
 * Whether to offer the direct WhatsApp shortcut.
 *
 * Desktops without `navigator.share` need it as the only one-tap route, and
 * phones get it *even when* the OS sheet exists: the reported complaint was a
 * link created on Android with no way through to WhatsApp, and a tile beats
 * hunting for it inside the system sheet.
 */
export function shouldShowWhatsApp(
  nav: Partial<Navigator> | null | undefined,
  matchCoarse: boolean,
): boolean {
  return !canNativeShare(nav) || matchCoarse;
}
