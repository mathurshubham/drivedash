'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Link as LinkIcon,
  Mail,
  Pin,
  PinOff,
  Tag,
  X,
} from 'lucide-react';
import KindIcon from '@/components/KindIcon';
import GroupPicker from '@/components/GroupPicker';
import { useToast } from '@/components/Toast';
import { copyForClient, downloadUrl, shareFile } from '@/lib/client';
import type { DriveFile, FileKind, HotGroup, HotItem, ShareMode } from '@/lib/types';

export interface SheetTarget {
  id: string;
  name: string;
  mimeType: string;
  kind: FileKind;
  webViewLink: string;
  iconLink?: string;
}

export function targetFromFile(file: DriveFile): SheetTarget {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    kind: file.kind,
    webViewLink: file.webViewLink,
    iconLink: file.iconLink,
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
  };
}

const NATIVE_KINDS: FileKind[] = ['slides', 'docs', 'sheets'];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Panel = 'menu' | 'email' | 'copy' | 'pin' | 'move' | 'label';

/**
 * Render with `key={target?.id}` so per-file form state resets on each open
 * rather than being cleared from an effect.
 */
export interface ActionSheetProps {
  target: SheetTarget | null;
  groups: HotGroup[];
  onClose: () => void;
  onPin: (item: HotItem, groupId: string) => void;
  onUnpin: (fileId: string) => void;
  onSetLabel: (fileId: string, label: string) => void;
  onMoveToGroup: (fileId: string, groupId: string) => void;
  onCreateGroup: (name: string) => void;
  /** False while the pinned list is still loading or failed to load; pin controls are disabled. */
  hotListReady?: boolean;
  /** Called after a successful "copy for client" so cached hotlist settings can be refreshed. */
  onAfterCopy?: () => void;
}

export default function ActionSheet({
  target,
  groups,
  onClose,
  onPin,
  onUnpin,
  onSetLabel,
  onMoveToGroup,
  onCreateGroup,
  hotListReady = true,
  onAfterCopy,
}: ActionSheetProps) {
  const toast = useToast();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The parent passes a fresh `onClose` arrow on every render; keeping it in a ref
  // lets the open/close effect depend only on `open`, so a re-render (e.g. a toast)
  // cannot re-pin the body or steal focus back to the first control.
  const onCloseRef = useRef(onClose);

  const [panel, setPanel] = useState<Panel>('menu');
  const [busy, setBusy] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientShare, setClientShare] = useState<ShareMode>('anyone');
  const [clientEmail, setClientEmail] = useState('');
  const [label, setLabelValue] = useState('');

  const open = target !== null;
  const pinnedGroup = target
    ? groups.find((g) => g.items.some((i) => i.fileId === target.id))
    : undefined;
  const pinnedItem = target
    ? pinnedGroup?.items.find((i) => i.fileId === target.id)
    : undefined;
  const canPdf = target ? NATIVE_KINDS.includes(target.kind) || target.kind === 'pdf' : false;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape to close, focus trap + restore, and an iOS-safe body scroll lock.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      );

    // Focus the first control, or the panel itself when it has none yet.
    (focusable()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active) && active !== panel;
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    // `overflow: hidden` on <body> does not stop scrolling in iOS Safari, so pin
    // the body at its current offset instead and restore the scroll on close.
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!target) return null;

  const showFallback = (text: string) => {
    setFallbackLink(text);
    toast('Could not copy automatically — select the link below', 'error');
  };

  /**
   * Copy a link that is not known yet. iOS Safari (including a standalone PWA)
   * rejects `writeText` once the user-gesture window has closed, so when the async
   * ClipboardItem form is available we hand the clipboard the *promise*
   * synchronously inside the click handler and let it resolve later. Everywhere
   * else we fall back to awaiting the value and calling `writeText`.
   *
   * Never rejects: clipboard failures show the readonly-input fallback, and a
   * rejection of `p` itself is left to the caller to report.
   */
  const copyLinkFromPromise = (p: Promise<string>, message = 'Link copied'): Promise<void> => {
    const onCopied = () => {
      setFallbackLink(null);
      toast(message);
    };
    const onCopyFailed = () =>
      p.then(showFallback, () => {
        // The link never arrived; the caller toasts that failure.
      });

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        const item = new ClipboardItem({
          'text/plain': p.then((text) => new Blob([text], { type: 'text/plain' })),
        });
        return navigator.clipboard.write([item]).then(onCopied, onCopyFailed);
      } catch {
        return onCopyFailed();
      }
    }

    return p.then(
      async (text) => {
        try {
          if (!navigator.clipboard) throw new Error('no clipboard');
          await navigator.clipboard.writeText(text);
          onCopied();
        } catch {
          showFallback(text);
        }
      },
      () => {
        // Caller reports it.
      },
    );
  };

  const download = (format: 'native' | 'pdf') => {
    const a = document.createElement('a');
    a.href = downloadUrl(target.id, format);
    // In an iOS standalone PWA an in-place attachment navigation replaces the app
    // view; a named target plus `download` keeps the sheet on screen.
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = target.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Not `async`: the request and the clipboard call must both start synchronously
  // inside the click/submit handler to stay in the user-gesture window.
  const doShare = (mode: 'anyone' | 'email', address?: string) => {
    setBusy(mode);
    const req = shareFile(target.id, mode === 'email' ? { mode, email: address } : { mode });
    const copied =
      mode === 'anyone' ? copyLinkFromPromise(req.then((res) => res.link)) : Promise.resolve();

    void req
      .then(
        () => {
          if (mode === 'email') {
            toast(`Shared with ${address}`);
            setPanel('menu');
          }
        },
        (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Share failed', 'error');
        },
      )
      .then(() => copied)
      .finally(() => setBusy(null));
  };

  const doCopyForClient = () => {
    setBusy('copy');
    const req = copyForClient(target.id, {
      clientName: clientName.trim(),
      share: clientShare,
      ...(clientShare === 'email' ? { email: clientEmail.trim() } : null),
    });

    const copied =
      clientShare === 'none'
        ? Promise.resolve()
        : copyLinkFromPromise(
            req.then((res) => {
              if (!res.link) throw new Error('no_link');
              return res.link;
            }),
            'Client link copied',
          );

    void req
      .then(
        (res) => {
          onAfterCopy?.();
          if (!res.link) toast(`Copied to Drive as “${res.file.name}”`);
          setPanel('menu');
        },
        (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Copy failed', 'error');
        },
      )
      .then(() => copied)
      .finally(() => setBusy(null));
  };

  const itemClass =
    'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-50 dark:hover:bg-neutral-800 dark:focus-visible:outline-accent-400';
  const inputClass =
    'min-h-[44px] w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-900';
  const primaryClass =
    'flex min-h-[44px] items-center justify-center rounded-lg bg-accent-600 px-4 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet-in relative max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white pb-safe shadow-2xl outline-none dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <KindIcon kind={target.kind} iconLink={target.iconLink} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold">
              {pinnedItem?.label ?? target.name}
            </h2>
            {pinnedGroup ? (
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                Pinned in {pinnedGroup.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close actions"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="p-2">
          {panel === 'menu' ? (
            <div className="space-y-0.5">
              <a
                href={target.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass}
              >
                <ExternalLink aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                Open in Drive
              </a>

              <button type="button" className={itemClass} onClick={() => download('native')}>
                <Download aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                Download
              </button>

              {canPdf ? (
                <button type="button" className={itemClass} onClick={() => download('pdf')}>
                  <FileDown aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                  Download as PDF
                </button>
              ) : null}

              <button
                type="button"
                className={itemClass}
                disabled={busy === 'anyone'}
                onClick={() => doShare('anyone')}
              >
                <LinkIcon aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                {busy === 'anyone' ? 'Creating link…' : 'Share link (anyone)'}
              </button>

              <button type="button" className={itemClass} onClick={() => setPanel('email')}>
                <Mail aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                Share to email
              </button>

              <button type="button" className={itemClass} onClick={() => setPanel('copy')}>
                <Copy aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                Copy for client
              </button>

              {pinnedGroup ? (
                <>
                  <button
                    type="button"
                    className={itemClass}
                    disabled={!hotListReady}
                    onClick={() => {
                      onUnpin(target.id);
                      onClose();
                    }}
                  >
                    <PinOff aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                    Unpin
                  </button>
                  <button
                    type="button"
                    className={itemClass}
                    disabled={!hotListReady}
                    onClick={() => {
                      setLabelValue(pinnedItem?.label ?? '');
                      setPanel('label');
                    }}
                  >
                    <Tag aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                    Set label
                  </button>
                  <button
                    type="button"
                    className={itemClass}
                    disabled={!hotListReady}
                    onClick={() => setPanel('move')}
                  >
                    <ArrowRightLeft aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                    Move to group
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={itemClass}
                  disabled={!hotListReady}
                  onClick={() => setPanel('pin')}
                >
                  <Pin aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                  {hotListReady ? 'Pin to group' : 'Pin to group (list not loaded)'}
                </button>
              )}

              {fallbackLink ? (
                <div className="mt-2 space-y-1 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
                  <label
                    htmlFor={`${titleId}-fallback`}
                    className="block text-xs font-medium text-neutral-600 dark:text-neutral-300"
                  >
                    Copy this link manually
                  </label>
                  <input
                    id={`${titleId}-fallback`}
                    readOnly
                    value={fallbackLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {panel === 'email' ? (
            <form
              className="space-y-3 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                doShare('email', email.trim());
              }}
            >
              <label htmlFor={`${titleId}-email`} className="block text-sm font-medium">
                Share with email
              </label>
              <input
                id={`${titleId}-email`}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy === 'email' || !email.trim()} className={primaryClass}>
                  {busy === 'email' ? 'Sharing…' : 'Share'}
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('menu')}
                  className="min-h-[44px] rounded-lg px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {panel === 'copy' ? (
            <form
              className="space-y-3 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                doCopyForClient();
              }}
            >
              <div className="space-y-1">
                <label htmlFor={`${titleId}-client`} className="block text-sm font-medium">
                  Client name
                </label>
                <input
                  id={`${titleId}-client`}
                  required
                  maxLength={80}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Acme Ltd"
                  className={inputClass}
                />
              </div>

              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Share the copy</legend>
                {(
                  [
                    ['anyone', 'Anyone with the link'],
                    ['email', 'A specific email'],
                    ['none', "Don't share"],
                  ] as const
                ).map(([value, text]) => (
                  <label
                    key={value}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <input
                      type="radio"
                      name={`${titleId}-share-mode`}
                      value={value}
                      checked={clientShare === value}
                      onChange={() => setClientShare(value)}
                      className="h-4 w-4 accent-accent-600"
                    />
                    {text}
                  </label>
                ))}
              </fieldset>

              {clientShare === 'email' ? (
                <div className="space-y-1">
                  <label htmlFor={`${titleId}-client-email`} className="block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id={`${titleId}-client-email`}
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className={inputClass}
                  />
                </div>
              ) : null}

              <div className="flex gap-2">
                <button type="submit" disabled={busy === 'copy' || !clientName.trim()} className={primaryClass}>
                  {busy === 'copy' ? 'Copying…' : 'Create copy'}
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('menu')}
                  className="min-h-[44px] rounded-lg px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {panel === 'pin' || panel === 'move' ? (
            <div className="space-y-3 p-2">
              <p className="text-sm font-medium">
                {panel === 'pin' ? 'Pin to group' : 'Move to group'}
              </p>
              <GroupPicker
                groups={groups}
                selectedGroupId={pinnedGroup?.id}
                onCreateGroup={onCreateGroup}
                onPick={(groupId) => {
                  if (panel === 'pin') onPin(toHotItem(target), groupId);
                  else onMoveToGroup(target.id, groupId);
                  onClose();
                }}
              />
              <button
                type="button"
                onClick={() => setPanel('menu')}
                className="min-h-[44px] rounded-lg px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Back
              </button>
            </div>
          ) : null}

          {panel === 'label' ? (
            <form
              className="space-y-3 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSetLabel(target.id, label);
                onClose();
              }}
            >
              <label htmlFor={`${titleId}-label`} className="block text-sm font-medium">
                Label (shown instead of the file name)
              </label>
              <input
                id={`${titleId}-label`}
                value={label}
                onChange={(e) => setLabelValue(e.target.value)}
                placeholder={target.name}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button type="submit" className={primaryClass}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('menu')}
                  className="min-h-[44px] rounded-lg px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Back
                </button>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Leave empty to clear the label.
              </p>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
