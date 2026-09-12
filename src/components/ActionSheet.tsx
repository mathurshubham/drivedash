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
  onAfterCopy,
}: ActionSheetProps) {
  const toast = useToast();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Escape to close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!target) return null;

  const copyToClipboard = async (text: string, message = 'Link copied') => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setFallbackLink(null);
      toast(message);
    } catch {
      setFallbackLink(text);
      toast('Could not copy automatically — select the link below', 'error');
    }
  };

  const download = (format: 'native' | 'pdf') => {
    const a = document.createElement('a');
    a.href = downloadUrl(target.id, format);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const doShare = async (mode: 'anyone' | 'email', address?: string) => {
    setBusy(mode);
    try {
      const res = await shareFile(target.id, mode === 'email' ? { mode, email: address } : { mode });
      if (mode === 'email') {
        toast(`Shared with ${address}`);
        setPanel('menu');
      } else {
        await copyToClipboard(res.link);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Share failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doCopyForClient = async () => {
    setBusy('copy');
    try {
      const res = await copyForClient(target.id, {
        clientName: clientName.trim(),
        share: clientShare,
        ...(clientShare === 'email' ? { email: clientEmail.trim() } : null),
      });
      onAfterCopy?.();
      if (res.link) {
        await copyToClipboard(res.link, 'Client link copied');
      } else {
        toast(`Copied to Drive as “${res.file.name}”`);
      }
      setPanel('menu');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Copy failed', 'error');
    } finally {
      setBusy(null);
    }
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
                onClick={() => void doShare('anyone')}
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
                    onClick={() => {
                      setLabelValue(pinnedItem?.label ?? '');
                      setPanel('label');
                    }}
                  >
                    <Tag aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                    Set label
                  </button>
                  <button type="button" className={itemClass} onClick={() => setPanel('move')}>
                    <ArrowRightLeft aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                    Move to group
                  </button>
                </>
              ) : (
                <button type="button" className={itemClass} onClick={() => setPanel('pin')}>
                  <Pin aria-hidden="true" className="h-5 w-5 text-neutral-500" />
                  Pin to group
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
                void doShare('email', email.trim());
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
                void doCopyForClient();
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
