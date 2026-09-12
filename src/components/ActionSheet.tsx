'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Link as LinkIcon,
  Mail,
  Pin,
  PinOff,
  Tag,
} from 'lucide-react';
import KindIcon, { KIND_LABEL, KIND_TILE } from '@/components/KindIcon';
import GroupPicker from '@/components/GroupPicker';
import CopyForClientView, { type CopyForClientSubmit } from '@/components/sheet/CopyForClientView';
import LabelView from '@/components/sheet/LabelView';
import ShareAnyoneView from '@/components/sheet/ShareAnyoneView';
import ShareEmailView, { type ShareEmailSubmit } from '@/components/sheet/ShareEmailView';
import ShareResultView, { type ShareResult } from '@/components/sheet/ShareResultView';
import { SubView, inputClass } from '@/components/sheet/fields';
import {
  NATIVE_KINDS,
  expiryPhrase,
  toHotItem,
  type SheetTarget,
  type SheetView,
} from '@/components/sheet/types';
import { useToast } from '@/components/Toast';
import Pressable from '@/components/ui/Pressable';
import Sheet, { SheetTransition, useSheetStack } from '@/components/ui/Sheet';
import { copyForClient, downloadUrl, shareFile } from '@/lib/client';
import type { ExpiryDays, HotGroup, HotItem, ShareEntry } from '@/lib/types';

export { targetFromFile, targetFromHotItem, toHotItem } from '@/components/sheet/types';
export type { SheetTarget, SheetView } from '@/components/sheet/types';

export interface ActionSheetProps {
  target: SheetTarget | null;
  /** Sub-view to open on, e.g. `'anyone'` when the row was swiped to Share. */
  initialView?: SheetView;
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
  /** Called after any successful share so the ledger hook can add the entry without a refetch. */
  onShareCreated?: (entry: ShareEntry) => void;
}

/**
 * The long-press sheet. The body is keyed by file id, so form state resets per
 * file without an effect — while the sheet itself stays mounted through the
 * close animation.
 */
export default function ActionSheet({ target, onClose, ...rest }: ActionSheetProps) {
  const [shown, setShown] = useState<SheetTarget | null>(target);
  if (target && target.id !== shown?.id) setShown(target);

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {shown ? (
        <SheetBody key={shown.id} target={shown} onClose={onClose} {...rest} />
      ) : null}
    </Sheet>
  );
}

function SheetBody({
  target,
  initialView,
  groups,
  onClose,
  onPin,
  onUnpin,
  onSetLabel,
  onMoveToGroup,
  onCreateGroup,
  hotListReady = true,
  onAfterCopy,
  onShareCreated,
}: ActionSheetProps & { target: SheetTarget }) {
  const toast = useToast();
  const fallbackId = useId();
  const stack = useSheetStack<SheetView>('menu');
  const [busy, setBusy] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);

  /** Land on the outcome screen; `swap` keeps Back pointing at the root menu. */
  const showResult = (next: ShareResult) => {
    setResult(next);
    stack.swap('result');
  };

  const pinnedGroup = groups.find((g) => g.items.some((i) => i.fileId === target.id));
  const pinnedItem = pinnedGroup?.items.find((i) => i.fileId === target.id);
  const canPdf = NATIVE_KINDS.includes(target.kind) || target.kind === 'pdf';

  // A swipe can open the sheet straight on a sub-view; the ref keeps React's
  // double-invoked mount effect from pushing it twice.
  const jumped = useRef(false);
  const push = stack.push;
  useEffect(() => {
    if (jumped.current || !initialView || initialView === 'menu') return;
    jumped.current = true;
    push(initialView);
  }, [initialView, push]);

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
  const copyLinkFromPromise = (
    p: Promise<string>,
    message: string | (() => string) = 'Link copied',
  ): Promise<void> => {
    const onCopied = () => {
      setFallbackLink(null);
      toast(typeof message === 'function' ? message() : message, 'success');
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
  const doShareAnyone = (expiry: ExpiryDays) => {
    setBusy('anyone');
    const req = shareFile(target.id, { mode: 'anyone', expiresInDays: expiry });
    const copied = copyLinkFromPromise(
      req.then((res) => {
        onShareCreated?.(res.entry);
        return res.link;
      }),
    );

    void req
      .then(
        (res) => {
          // An 'external' link was already public before we touched it, so it
          // carries no expiry we control and nothing here may imply a revoke.
          showResult({
            fileName: target.name,
            url: res.link,
            line:
              res.entry.kind === 'external' ? 'Link ready' : `Link ready · ${expiryPhrase(expiry)}`,
            ...(res.entry.kind === 'external'
              ? { note: 'This file was already public — the link is not managed here.' }
              : null),
          });
        },
        (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Share failed', 'error');
        },
      )
      .then(() => copied)
      .finally(() => setBusy(null));
  };

  const doShareEmail = ({ email, notify, message, expiry }: ShareEmailSubmit) => {
    setBusy('email');
    const req = shareFile(target.id, {
      mode: 'email',
      email,
      notify,
      ...(notify && message.trim() ? { message } : {}),
      expiresInDays: expiry,
    });

    void req
      .then(
        (res) => {
          onShareCreated?.(res.entry);
          showResult({
            fileName: target.name,
            url: res.link,
            line: notify ? `Emailed to ${email}` : `Shared with ${email}`,
          });
        },
        (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Share failed', 'error');
        },
      )
      .finally(() => setBusy(null));
  };

  const doCopyForClient = ({
    clientName,
    share,
    email,
    notify,
    message,
    expiry,
  }: CopyForClientSubmit) => {
    setBusy('copy');
    const req = copyForClient(target.id, {
      clientName,
      share,
      ...(share === 'email' ? { email } : null),
      notify,
      ...(share === 'email' && notify && message.trim() ? { message } : {}),
      expiresInDays: expiry,
    });

    const copied =
      share === 'none'
        ? Promise.resolve()
        : copyLinkFromPromise(
            req.then((res) => {
              if (!res.link) throw new Error('no_link');
              return res.link;
            }),
          );

    void req
      .then(
        (res) => {
          onAfterCopy?.();
          onShareCreated?.(res.entry);
          showResult({
            fileName: res.file.name,
            url: res.link,
            line: `Copy created for ${clientName}`,
            ...(res.link ? null : { note: 'The copy was not shared.' }),
          });
        },
        (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Copy failed', 'error');
        },
      )
      .then(() => copied)
      .finally(() => setBusy(null));
  };

  const back = () => stack.back();

  return (
    <div className="pb-2">
      <div className="flex items-start gap-3 border-b border-subtle pb-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${KIND_TILE[target.kind]}`}
        >
          <KindIcon kind={target.kind} iconLink={target.iconLink} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{pinnedItem?.label ?? target.name}</p>
          <p className="truncate text-xs text-muted">
            {KIND_LABEL[target.kind]}
            {pinnedGroup ? ` · Pinned in ${pinnedGroup.name}` : ''}
          </p>
        </div>
      </div>

      <SheetTransition viewKey={stack.view} direction={stack.direction}>
        {stack.view === 'menu' ? (
          <div className="space-y-2 pt-3">
            <div className="flex gap-2">
              <QuickTile
                as="a"
                href={target.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ExternalLink aria-hidden="true" className="h-5 w-5" />}
                label="Open"
              />
              {pinnedGroup ? (
                <QuickTile
                  icon={<PinOff aria-hidden="true" className="h-5 w-5" />}
                  label="Unpin"
                  disabled={!hotListReady}
                  onClick={() => {
                    onUnpin(target.id);
                    onClose();
                  }}
                />
              ) : (
                <QuickTile
                  icon={<Pin aria-hidden="true" className="h-5 w-5" />}
                  label="Pin"
                  disabled={!hotListReady}
                  onClick={() => stack.push('pin')}
                />
              )}
              <QuickTile
                icon={<LinkIcon aria-hidden="true" className="h-5 w-5" />}
                label="Get link"
                onClick={() => stack.push('anyone')}
              />
              <QuickTile
                icon={<Copy aria-hidden="true" className="h-5 w-5" />}
                label="For client"
                onClick={() => stack.push('copy')}
              />
            </div>

            <ul>
              <ListRow
                icon={<Download aria-hidden="true" className="h-5 w-5 text-muted" />}
                label="Download"
                onClick={() => download('native')}
              />
              {canPdf ? (
                <ListRow
                  icon={<FileDown aria-hidden="true" className="h-5 w-5 text-muted" />}
                  label="Download as PDF"
                  onClick={() => download('pdf')}
                />
              ) : null}
              <ListRow
                icon={<Mail aria-hidden="true" className="h-5 w-5 text-muted" />}
                label="Send by email"
                onClick={() => stack.push('email')}
              />
              {pinnedGroup ? (
                <>
                  <ListRow
                    icon={<Tag aria-hidden="true" className="h-5 w-5 text-muted" />}
                    label="Set label"
                    disabled={!hotListReady}
                    onClick={() => stack.push('label')}
                  />
                  <ListRow
                    icon={<ArrowRightLeft aria-hidden="true" className="h-5 w-5 text-muted" />}
                    label="Move to group"
                    disabled={!hotListReady}
                    onClick={() => stack.push('move')}
                  />
                </>
              ) : null}
            </ul>

            {!hotListReady ? (
              <p className="px-1 text-xs text-muted">
                Pinning is unavailable until the pinned list loads.
              </p>
            ) : null}

            {fallbackLink ? (
              <div className="space-y-1 rounded-md surface-2 p-3">
                <label htmlFor={fallbackId} className="block text-xs font-medium text-muted">
                  Copy this link manually
                </label>
                <input
                  id={fallbackId}
                  readOnly
                  value={fallbackLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className={inputClass}
                />
              </div>
            ) : null}
          </div>
        ) : stack.view === 'anyone' ? (
          <ShareAnyoneView busy={busy === 'anyone'} onShare={doShareAnyone} onBack={back} />
        ) : stack.view === 'email' ? (
          <ShareEmailView busy={busy === 'email'} onShare={doShareEmail} onBack={back} />
        ) : stack.view === 'copy' ? (
          <CopyForClientView busy={busy === 'copy'} onCopy={doCopyForClient} onBack={back} />
        ) : stack.view === 'result' && result ? (
          <ShareResultView result={result} onBack={back} onDone={onClose} />
        ) : stack.view === 'label' ? (
          <LabelView
            initial={pinnedItem?.label ?? ''}
            fileName={target.name}
            onSave={(label) => {
              onSetLabel(target.id, label);
              onClose();
            }}
            onBack={back}
          />
        ) : stack.view === 'pin' || stack.view === 'move' ? (
          <SubView title={stack.view === 'pin' ? 'Pin to group' : 'Move to group'} onBack={back}>
            <GroupPicker
              groups={groups}
              selectedGroupId={pinnedGroup?.id}
              onCreateGroup={onCreateGroup}
              onPick={(groupId) => {
                if (stack.view === 'pin') onPin(toHotItem(target), groupId);
                else onMoveToGroup(target.id, groupId);
                onClose();
              }}
            />
          </SubView>
        ) : null}
      </SheetTransition>
    </div>
  );
}

const QUICK_TILE = 'h-[72px] flex-1 rounded-md px-1';
const QUICK_CONTENT = 'flex flex-col items-center gap-1';

type QuickTileProps =
  | { icon: ReactNode; label: string; as: 'a'; href: string; target?: string; rel?: string }
  | { icon: ReactNode; label: string; as?: never; onClick: () => void; disabled?: boolean };

/** One of the four square shortcuts at the top of the sheet. */
function QuickTile(props: QuickTileProps) {
  const body = (
    <>
      {props.icon}
      <span className="text-[0.75rem] font-medium leading-none">{props.label}</span>
    </>
  );

  if (props.as === 'a') {
    return (
      <Pressable
        as="a"
        href={props.href}
        target={props.target}
        rel={props.rel}
        variant="secondary"
        className={QUICK_TILE}
        contentClassName={QUICK_CONTENT}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable
      variant="secondary"
      disabled={props.disabled}
      onClick={props.onClick}
      className={QUICK_TILE}
      contentClassName={QUICK_CONTENT}
    >
      {body}
    </Pressable>
  );
}

function ListRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <Pressable
        variant="ghost"
        block
        size="lg"
        disabled={disabled}
        onClick={onClick}
        className="justify-start px-3 text-left"
        contentClassName="flex w-full min-w-0 items-center gap-3"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
      </Pressable>
    </li>
  );
}
