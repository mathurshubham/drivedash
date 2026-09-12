'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, Copy, MessageCircle, Share2 } from 'lucide-react';
import { BackButton } from '@/components/sheet/fields';
import { useToast } from '@/components/Toast';
import Pressable from '@/components/ui/Pressable';
import { useMounted } from '@/components/ui/Portal';
import { canNativeShare, shouldShowWhatsApp, whatsappHref } from '@/lib/shareTarget';

/** Which onward-share tiles this device can actually offer. Client-only. */
function shareTargets() {
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return {
    native: canNativeShare(navigator),
    whatsapp: shouldShowWhatsApp(navigator, coarse),
  };
}

export interface ShareResult {
  /** The file the link points at — the share sheet's title and the WhatsApp first line. */
  fileName: string;
  /** The created link, or `null` when the flow made a copy without sharing it. */
  url: string | null;
  /** One line of outcome: "Link ready · expires in 3 days", "Emailed to a@b.com". */
  line: string;
  /**
   * A caveat under the line — used when the link is not ours to manage (the
   * file was already public), so nothing here implies an expiry or a revoke.
   */
  note?: string;
}

export interface ShareResultViewProps {
  result: ShareResult;
  /** Returns to the sheet's root menu. */
  onBack: () => void;
  /** Closes the whole sheet. */
  onDone: () => void;
}

/**
 * What the user sees after a share succeeds. The sheet used to close straight
 * into a toast, which on a phone left the link copied and nowhere to put it:
 * this view is where the handing-on happens — the OS share sheet, a direct
 * WhatsApp shortcut, or the clipboard again.
 */
export default function ShareResultView({ result, onBack, onDone }: ShareResultViewProps) {
  const toast = useToast();
  const { fileName, url, line, note } = result;

  // `navigator` and `matchMedia` are client-only, so which tiles exist cannot be
  // decided until after hydration — `useMounted` is the hydration-safe flag for
  // exactly that, and keeps the first client render identical to the server's.
  const mounted = useMounted();
  const targets = mounted ? shareTargets() : { native: false, whatsapp: false };

  // Not `async`: `navigator.share` must be called inside the click handler to
  // keep its user-activation, so the promise is awaited after the fact.
  const nativeShare = () => {
    if (!url) return;
    try {
      void navigator
        .share({ title: fileName, text: `Here is the file: ${fileName}`, url })
        .catch((err: unknown) => {
          // The user backing out of the OS sheet is not a failure.
          if (err instanceof Error && err.name === 'AbortError') return;
          toast('Could not open the share sheet', 'error');
        });
    } catch {
      toast('Could not open the share sheet', 'error');
    }
  };

  const copy = () => {
    if (!url) return;
    void (navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'))).then(
      () => toast('Copied', 'success'),
      () => toast('Could not copy — select the link above', 'error'),
    );
  };

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center">
        <Pressable
          variant="ghost"
          aria-label="Back"
          onClick={onBack}
          className="-ml-1 w-11 shrink-0 rounded-md px-0 text-muted"
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Pressable>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <SuccessCheck />
        <p className="text-sm font-semibold">{line}</p>
        {note ? <p className="text-xs text-muted">{note}</p> : null}
      </div>

      {url ? (
        <>
          <div className="flex items-center gap-2 rounded-md surface-2 py-2 pl-3 pr-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={url}>
              {url}
            </span>
            <Pressable
              variant="ghost"
              size="icon"
              aria-label="Copy link"
              onClick={copy}
              className="text-muted"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
            </Pressable>
          </div>

          <div className="flex gap-2">
            {targets.native ? (
              <ShareTile
                icon={<Share2 aria-hidden="true" className="h-5 w-5" />}
                label="Share…"
                onClick={nativeShare}
              />
            ) : null}
            {targets.whatsapp ? (
              <ShareTile
                icon={<MessageCircle aria-hidden="true" className="h-5 w-5" />}
                label="WhatsApp"
                href={whatsappHref(fileName, url)}
              />
            ) : null}
            <ShareTile
              icon={<Copy aria-hidden="true" className="h-5 w-5" />}
              label="Copy"
              onClick={copy}
            />
          </div>
        </>
      ) : null}

      <BackButton onClick={onDone} label="Done" />
    </div>
  );
}

const TILE = 'h-[68px] flex-1 rounded-md px-1';
const TILE_CONTENT = 'flex flex-col items-center gap-1.5';

function ShareTile({
  icon,
  label,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      {icon}
      <span className="text-[0.75rem] font-medium leading-none">{label}</span>
    </>
  );

  if (href) {
    return (
      <Pressable
        as="a"
        href={href}
        target="_blank"
        rel="noopener"
        variant="secondary"
        className={TILE}
        contentClassName={TILE_CONTENT}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable
      variant="secondary"
      onClick={onClick}
      className={TILE}
      contentClassName={TILE_CONTENT}
    >
      {body}
    </Pressable>
  );
}

/**
 * The check draws itself in via `.draw-check` (a CSS keyframe, so it survives
 * motion loading late) and is shown finished under `prefers-reduced-motion`.
 */
function SuccessCheck() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full surface-2 text-success">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M5 12.5 10 17.5 19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="draw-check"
        />
      </svg>
    </span>
  );
}
