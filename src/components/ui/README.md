# UI primitives

Import from `@/components/ui`. All are client components except the pure helpers.

## Tokens (`src/app/globals.css`)

Colours resolve light/dark automatically via `light-dark()` — **do not add `dark:` variants for these**:
`bg-bg` · `surface` · `surface-2` · `border-subtle` · `text-fg` · `text-muted` · `text-accent` /
`ring-accent` (auto accent-600/400) · `text-success` · `text-warn` · `text-danger`.
The accent-50…900 scale is unchanged; filled CTAs use `bg-accent-600` + white.

Type: `text-xs` 13 · `text-sm` 15 · `text-base` 17 · `text-lg` 20 · `text-xl` 24. Weights 400/500/600.
Radii: `rounded-sm` 10 · `rounded-md` 14 · `rounded-lg` 20 · `rounded-full`.
Shadow: `shadow-sheet`, `shadow-pop`. Motion: `--dur-fast` 120ms, `--dur-base` 200ms, `--ease-out`.
Helpers: `.pb-nav` (clears BottomNav), `.pt-safe/.pb-safe/.px-safe`, `.tabular`, `.skeleton`,
`.no-scrollbar`, `.animate-page-enter` (route transition), `.reveal`/`.is-revealed` (scroll reveal).
`--nav-h` (56px) is the bottom nav's height and the single source `.pb-nav` and the toaster offset
both read — change the nav's height there and nowhere else.
Springs in JS: sheet `{stiffness:420,damping:34}`, reorder/indicator `{stiffness:500,damping:40}`.

## Components

- `<MotionProvider>` / `<AppShell>` — `LazyMotion domAnimation strict` (+ `ToastProvider`). Already mounted in `(app)/layout.tsx`. Only `m.*`, never `motion.*`.
- `<Sheet open onOpenChange title? snapPoints? className?>` — vaul drawer, handle, blurred scrim, safe-area padding. Default snap points are `sheetSnapPoints(window.innerHeight)` = `['<min(560,92dvh)>px', 0.92]`: the first rest position is content-sized, because a fraction-based first point left the action sheet mostly below the fold on short viewports. vaul `parseInt`s string snap points, so only plain `"560px"` forms work — never `calc()`/`min()`. `<Sheet.Section title?>` / `<SheetSection>` for blocks. vaul is code-split: the panel loads on first open and costs nothing before that, so mount `<Sheet>` freely.
- `<SheetTransition viewKey direction?='forward'|'back'>` — 16px slide + fade 200ms for sub-form swaps.
- `useSheetStack(root)` → `{ view, depth, direction, push, back, reset, swap }`. `swap(view)` goes
  forward but drops what it came from, so `back` lands on the root — that is how the share sheet's
  `ShareResultView` avoids offering a way back into the form that just submitted.
- `<Pressable as?='button'|'a'|Link variant?='primary'|'secondary'|'ghost'|'danger' size?='md'(44px)|'lg'(52px)|'icon'(36px square) loading? block? contentClassName? …native>` — tap-scale 0.97, focus ring, spinner. The children span is `inline-flex items-center justify-center gap-2` by default, so `<Glyph />Label` is a row. `contentClassName` **replaces** that default, for labels that are a layout of their own (file rows, stacked icon tiles).
  `size='icon'` is the only sub-44px target and is for a *secondary* affordance whose action is
  reachable another way (the shelf tile's "···", which long-press also opens).
  **Never pass `absolute` or `fixed` in `className`.** The base class list carries `relative`,
  and two position utilities resolve by stylesheet order, not by the order written — Tailwind
  emits `.relative` after `.absolute`, so `relative` wins and the button lays itself out in
  normal flow. (That is exactly how every shelf tile's "···" ended up rendering *below* its
  tile.) Wrap it: `<span className="absolute right-1 top-1"><Pressable …/></span>`. The same
  trap applies to `display` utilities, which is why `contentClassName` replaces rather than
  merges.
- `<Chip value selected? onSelect disabled? >` inside `<ChipGroup label value onValueChange?>` — 36px min, radiogroup with arrow/Home/End keys, sliding accent pill.
- `<Skeleton variant?='row'|'card'|'chip'|'text' width?>`, `<SkeletonList count?=3 variant? label? loading?>` (sets `aria-busy`).
- `<SwipeableRow leftAction? rightAction?>` with `{ label, icon?, tone?:'accent'|'neutral'|'danger', onTrigger }`. Right-drag reveals `leftAction`. Triggers past 56px or >0.4px/ms. Renders children plainly under reduced motion — always mirror the action in the sheet.
- `useLongPress(cb, { ms?=450, moveTolerance?=8 })` → spread onto an element; vibrates 10ms, swallows the trailing click.
- `<Toggletip label>{body}</Toggletip>` — 28px Info button, `role="dialog"`, flips above/below, closes on outside pointerdown / Escape / scroll.
- `<HintBadge storageKey label side?='top-right'>` — one-time pulsing dot; dismissed by any pointerdown in the wrapper; SSR-safe.
- `<EmptyState icon? title description? action?={label,onClick} footer?>`.
- `<Portal>` / `useMounted()` — SSR-safe `createPortal` into `document.body`. Every `fixed`
  overlay goes through it; see **z-layers**. `useMounted()` is the same hydration-safe flag on
  its own (`useSyncExternalStore` with a `false` server snapshot), for anything that must not
  render until the client's clock, locale or viewport is knowable — `GreetingBar`'s time-of-day
  word and date, for one.
- `<BottomNav items=[{href,label,icon,badge?,onClick?,tourId?}] onReselect?>` — active by `usePathname`, per-item static active state (opacity-transitioned pill, **not** a shared sliding indicator: that measured the DOM after the route changed and spent every navigation parked under the previous item), auto-hidden on `/login|/access-denied|/about|/privacy|/terms`. Give scroll containers `.pb-nav`.
  Hide-on-scroll is governed by `decideNavVisibility` and is deliberately hard to reach: a page
  with less than 240px of overflow never hides it (there is no scroll-up left to undo the hide —
  that is exactly how the first phone pass lost the nav for good), hiding starts only past 96px
  from the top, and it comes back within 48px of either end of the document, after 700ms of no
  scrolling, on route change, while any sheet or tour holds `lockNav()`, and on `dd:nav:show`.
  `showNav()` / `lockNav()` / `useNavLock(active)` are the ways to ask; `Sheet`, `Spotlight` and
  `TourOffer` already do.
- `<PullToRefresh onRefresh disabled? scrollRoot?='self'|'window'>` — touch only, engages at the top, threshold 64px, ≥500ms visible. Pass `scrollRoot="window"` when the document scrolls rather than the wrapper (the home page), or `scrollTop` is always 0 and the pull fires mid-page.
- `Toast` (`@/components/Toast`): `<ToastProvider>` (nesting-safe — exactly one `<Toaster>` ever
  mounts, and a stray second one warns in dev) and `useToast()` → `(message, kind?:
  'success'|'error'|'info'|'default')`, over `showToast`/`toastDuration` for non-React callers.
  Success draws its check in. Every toast passes an explicit `duration` (errors 4000ms,
  everything else 2500ms) and never `Infinity` — sonner skips the close timer for that value.
  sonner 2.x pauses a toast's timer while the toaster is hovered **or** `document.hidden` is
  true and, unlike 1.x, has no `pauseWhenPageIsHidden` prop to switch the latter off; a tab
  driven while not frontmost therefore kept its toast forever. `showToast` schedules its own
  `dismiss` at `duration + 4s` as the ceiling, because these toasts sit over the bottom nav.

## z-layers

One ladder, so nothing has to guess. Equal values resolve by DOM order, which is why the tour
offer is 45 and not 40 — at the nav's own layer the nav (rendered later) swallowed its clicks.

| Layer | z | Owner | Reaches `<body>` via |
|---|---|---|---|
| Page content | auto | pages | — |
| Bottom nav | 40 | `BottomNav` | rendered in `AppShell`, outside the page wrapper |
| Sheet scrim | 40 | `SheetImpl` (`Drawer.Overlay`) | vaul's own `Drawer.Portal` |
| Tour offer card | 45 | `onboarding/TourOffer` | `<Portal>` (sits at `calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)`, above the pinned nav) |
| Sheet panel | 50 | `SheetImpl` | vaul's own `Drawer.Portal` |
| Spotlight overlay | 50 | `onboarding/Spotlight` | `<Portal>` |
| Toggletip popover | 50 | `ui/Toggletip` | `<Portal>` |
| Toasts | 60 | `Toast` (`<Toaster style={{zIndex:60}}>`) | rendered in `AppShell`, outside the page wrapper |

**A z-index is only worth its number on the root stacking context.** Every `fixed` overlay in
the table above therefore reaches `document.body`, and the rightmost column says how. The
second Chrome pass found the Spotlight unable to dim the nav and the tour offer hard to click:
both were rendered inside the page, whose `.animate-page-enter` wrapper animates `transform`,
and a transformed ancestor makes a stacking context *and* a containing block for `fixed`
descendants — so their z-50 was scoped under the nav's z-40 sibling. Filters, `backdrop-filter`,
`will-change` and `contain` do the same thing; `.animate-page-enter` also ends on
`transform: none` (with `animation-fill-mode: both`) so it stops being one once it has run, but
**do not rely on that** — portal the overlay.

The toaster region is `pointer-events: none` and only the toast cards are `auto`; nothing in
`AppShell` may cover the bottom strip, or the nav stops taking taps.

## Pure helpers (unit-tested, safe in node)

`resolveSwipe(dx, vx)` → `'left'|'right'|'none'` · `clampSwipe` · `swipeProgress` ·
`placePopover(anchorRect, size, viewport)` → `{top,left,side}` ·
`longPressReducer(state, event, opts)` ·
`decideNavVisibility(state, {scrollY, scrollHeight, innerHeight, dt})` ·
`placeCoachmark(target, card, viewport, preferred, maxBottom)` / `coachmarkWidth(innerWidth)`
(`onboarding/coachmark`) ·
`hintStorageKey(id)` / `isHintDismissed` / `dismissHint` / `resetHint` ·
`buildShareText` / `whatsappHref` / `canNativeShare` / `shouldShowWhatsApp` (`@/lib/shareTarget` —
the onward-share tiles in the sheet's result view; every environment check is a parameter) ·
`sheetSnapPoints(viewportHeight)` (`SheetImpl`).

## Deviation to know about

`domAnimation` has no layout animations, so `layoutId` is replaced by `useSlidingIndicator(activeKey)`
(measure + animate `x/y/width/height`). Use it for any new sliding indicator; do not switch to `domMax`.
`domAnimation` itself is loaded after hydration (measured 11 KB cheaper than eager), so `m.*` elements
render statically for the first frames — never rely on an entry animation for legibility.
The toast success check is CSS (`.draw-check`), not `m.path`, for the same reason.

Page transitions are a CSS keyframe (`.animate-page-enter` on a `key={pathname}` wrapper), not a
motion `initial`, for the same reason: an `initial={{opacity:0}}` that never animates leaves the
whole page painted at 0. **Never give an element an `initial` that hides it.**

On `/` the primitives are imported deeply (`@/components/ui/Pressable`, not the barrel): the barrel
re-exports `Sheet`, `BottomNav` and friends, and pulling the whole graph into the home page's chunk
cost ~10 KB gzipped of first load. Use deep imports anywhere first-load size matters.
