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
- `useSheetStack(root)` → `{ view, depth, direction, push, back, reset }`.
- `<Pressable as?='button'|'a'|Link variant?='primary'|'secondary'|'ghost'|'danger' size?='md'(44px)|'lg'(52px) loading? block? contentClassName? …native>` — tap-scale 0.97, focus ring, spinner. The children span is `inline-flex items-center justify-center gap-2` by default, so `<Glyph />Label` is a row. `contentClassName` **replaces** that default, for labels that are a layout of their own (file rows, stacked icon tiles).
- `<Chip value selected? onSelect disabled? >` inside `<ChipGroup label value onValueChange?>` — 36px min, radiogroup with arrow/Home/End keys, sliding accent pill.
- `<Skeleton variant?='row'|'card'|'chip'|'text' width?>`, `<SkeletonList count?=3 variant? label? loading?>` (sets `aria-busy`).
- `<SwipeableRow leftAction? rightAction?>` with `{ label, icon?, tone?:'accent'|'neutral'|'danger', onTrigger }`. Right-drag reveals `leftAction`. Triggers past 56px or >0.4px/ms. Renders children plainly under reduced motion — always mirror the action in the sheet.
- `useLongPress(cb, { ms?=450, moveTolerance?=8 })` → spread onto an element; vibrates 10ms, swallows the trailing click.
- `<Toggletip label>{body}</Toggletip>` — 28px Info button, `role="dialog"`, flips above/below, closes on outside pointerdown / Escape / scroll.
- `<HintBadge storageKey label side?='top-right'>` — one-time pulsing dot; dismissed by any pointerdown in the wrapper; SSR-safe.
- `<EmptyState icon? title description? action?={label,onClick} footer?>`.
- `<BottomNav items=[{href,label,icon,badge?,onClick?,tourId?}] onReselect?>` — active by `usePathname`, per-item static active state (opacity-transitioned pill, **not** a shared sliding indicator: that measured the DOM after the route changed and spent every navigation parked under the previous item), hides on scroll-down, auto-hidden on `/login|/access-denied|/about|/privacy|/terms`. Give scroll containers `.pb-nav`.
- `<PullToRefresh onRefresh disabled? scrollRoot?='self'|'window'>` — touch only, engages at the top, threshold 64px, ≥500ms visible. Pass `scrollRoot="window"` when the document scrolls rather than the wrapper (the home page), or `scrollTop` is always 0 and the pull fires mid-page.
- `Toast` (`@/components/Toast`): `<ToastProvider>` (nesting-safe) and `useToast()` → `(message, kind?: 'success'|'error'|'info'|'default')`. Success draws its check in.

## z-layers

One ladder, so nothing has to guess. Equal values resolve by DOM order, which is why the tour
offer is 45 and not 40 — at the nav's own layer the nav (rendered later) swallowed its clicks.

| Layer | z | Owner |
|---|---|---|
| Page content | auto | pages |
| Bottom nav | 40 | `BottomNav` |
| Sheet scrim | 40 | `SheetImpl` (`Drawer.Overlay`) |
| Tour offer card | 45 | `onboarding/TourOffer` |
| Sheet panel / Spotlight / Toggletip popover | 50 | `SheetImpl`, `Spotlight`, `Toggletip` |
| Toasts | 60 | `Toast` (`<Toaster style={{zIndex:60}}>`) |

The toaster region is `pointer-events: none` and only the toast cards are `auto`; nothing in
`AppShell` may cover the bottom strip, or the nav stops taking taps.

## Pure helpers (unit-tested, safe in node)

`resolveSwipe(dx, vx)` → `'left'|'right'|'none'` · `clampSwipe` · `swipeProgress` ·
`placePopover(anchorRect, size, viewport)` → `{top,left,side}` ·
`longPressReducer(state, event, opts)` · `scrollDirectionReducer(state, y)` ·
`hintStorageKey(id)` / `isHintDismissed` / `dismissHint` / `resetHint` ·
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
