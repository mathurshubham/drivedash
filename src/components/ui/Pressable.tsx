'use client';

import { m, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import NextLink from 'next/link';
import type * as React from 'react';
import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react';

export type PressableVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type PressableSize = 'md' | 'lg' | 'icon';

const VARIANT: Record<PressableVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-700',
  secondary: 'surface text-fg border border-subtle hover:surface-2 active:surface-2',
  ghost: 'bg-transparent text-fg hover:surface-2 active:surface-2',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-90',
};

const SIZE: Record<PressableSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-[52px] px-5 text-base',
  /**
   * 36px square. Below the 44px floor on purpose and only for a *secondary*
   * affordance whose action is also reachable another way — the shelf tile's
   * "···", which long-press opens too. It is its own size rather than an
   * override because `min-h-11` from `md` would win on stylesheet order
   * whatever a caller wrote in `className`.
   */
  icon: 'h-9 w-9 min-h-9 shrink-0 px-0 text-sm',
};

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const TAP_SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;

/**
 * Motion-wrapped `next/link`, created once at module scope — building it inside
 * render would remount the tree on every pass.
 */
const MotionLink = m.create(NextLink);

/** The element kinds `as` accepts. Anything else would need its own motion wrapper. */
export type PressableAs = 'button' | 'a' | typeof NextLink;

export interface PressableOwnProps {
  variant?: PressableVariant;
  size?: PressableSize;
  /** Adds a spinner and blocks interaction. */
  loading?: boolean;
  /** Stretches to the container width. */
  block?: boolean;
  className?: string;
  /**
   * Classes for the span wrapping `children`. **Replaces** the default
   * `inline-flex items-center justify-center gap-2`; pass it whenever the
   * label is a layout of its own (a file row, a stacked icon tile) rather than
   * an icon-and-text row.
   */
  contentClassName?: string;
  children?: ReactNode;
}

/**
 * Motion redefines a handful of DOM handlers (`onDrag`, `onAnimationStart`,
 * …), so native props come from motion's own prop types rather than React's.
 */
type Native<T extends 'button' | 'a'> = Omit<HTMLMotionProps<T>, keyof PressableOwnProps | 'as' | 'ref'>;

type LinkNative = Omit<
  ComponentPropsWithoutRef<typeof NextLink>,
  keyof PressableOwnProps | 'as' | 'ref' | keyof HTMLMotionProps<'a'>
> &
  Native<'a'>;

export type PressableProps =
  | ({ as?: 'button'; ref?: Ref<HTMLButtonElement> } & PressableOwnProps & Native<'button'>)
  | ({ as: 'a'; ref?: Ref<HTMLAnchorElement> } & PressableOwnProps & Native<'a'>)
  | ({ as: typeof NextLink; ref?: Ref<HTMLAnchorElement>; href: LinkNative['href'] } & PressableOwnProps &
      LinkNative);

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The one interactive wrapper in the app: 44px minimum target, tap-scale
 * feedback (dropped under reduced motion), a visible focus ring and a loading
 * state. Renders a `<button>` by default; pass `as="a"` or `as={Link}`.
 */
export default function Pressable({
  as = 'button',
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  className = '',
  contentClassName = '',
  children,
  ...rest
}: PressableProps) {
  const reduced = useReducedMotion();

  const disabled = Boolean((rest as { disabled?: boolean }).disabled) || loading;
  const whileTap = reduced || disabled ? undefined : { scale: 0.97 };
  const classes =
    `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`.trim();

  // The label span is a flex row by default, so `<Glyph />Label` sits side by
  // side instead of stacking (a plain `<span>` is inline, and an inline SVG
  // with `h-5 w-5` then forces a line box of its own). `contentClassName`
  // replaces the default outright rather than merging: it exists precisely for
  // labels that are their own layout, and two competing `display` utilities in
  // one class list resolve by stylesheet order, not by the order written here.
  const layout = contentClassName || 'inline-flex items-center justify-center gap-2';

  const body = (
    <>
      {loading ? <Spinner /> : null}
      <span className={`${layout} ${loading ? 'opacity-70' : ''}`.trim()}>{children}</span>
    </>
  );

  if (as === 'button') {
    const { type, ...buttonRest } = rest as Native<'button'>;
    return (
      <m.button
        {...buttonRest}
        type={type ?? 'button'}
        disabled={disabled}
        aria-busy={loading || undefined}
        className={classes}
        whileTap={whileTap}
        transition={TAP_SPRING}
      >
        {body}
      </m.button>
    );
  }

  // Anchors cannot be `disabled`; mirror it for assistive tech and pointers.
  const linkProps = {
    ...(rest as Record<string, unknown>),
    'aria-disabled': disabled || undefined,
    tabIndex: disabled ? -1 : undefined,
    'aria-busy': loading || undefined,
    className: classes,
    whileTap,
    transition: TAP_SPRING,
  };

  if (as === 'a') {
    return <m.a {...(linkProps as Native<'a'>)}>{body}</m.a>;
  }
  return <MotionLink {...(linkProps as React.ComponentProps<typeof MotionLink>)}>{body}</MotionLink>;
}

/** Re-exported for `as={Link}` call sites so they need one import, not two. */
export { NextLink as Link };
