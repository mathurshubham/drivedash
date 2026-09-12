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
Helpers: `.pb-nav` (clears BottomNav), `.pt-safe/.pb-safe/.px-safe`, `.tabular`, `.skeleton`, `.no-scrollbar`.
Springs in JS: sheet `{stiffness:420,damping:34}`, reorder/indicator `{stiffness:500,damping:40}`.

## Components

- `<MotionProvider>` / `<AppShell>` — `LazyMotion domAnimation strict` (+ `ToastProvider`). Already mounted in `(app)/layout.tsx`. Only `m.*`, never `motion.*`.
- `<Sheet open onOpenChange title? snapPoints=[0.55,0.92] className?>` — vaul drawer, handle, blurred scrim, safe-area padding. `<Sheet.Section title?>` / `<SheetSection>` for blocks. vaul is code-split: the panel loads on first open and costs nothing before that, so mount `<Sheet>` freely.
- `<SheetTransition viewKey direction?='forward'|'back'>` — 16px slide + fade 200ms for sub-form swaps.
- `useSheetStack(root)` → `{ view, depth, direction, push, back, reset }`.
- `<Pressable as?='button'|'a'|Link variant?='primary'|'secondary'|'ghost'|'danger' size?='md'(44px)|'lg'(52px) loading? block? …native>` — tap-scale 0.97, focus ring, spinner.
- `<Chip value selected? onSelect disabled? >` inside `<ChipGroup label value onValueChange?>` — 36px min, radiogroup with arrow/Home/End keys, sliding accent pill.
- `<Skeleton variant?='row'|'card'|'chip'|'text' width?>`, `<SkeletonList count?=3 variant? label? loading?>` (sets `aria-busy`).
- `<SwipeableRow leftAction? rightAction?>` with `{ label, icon?, tone?:'accent'|'neutral'|'danger', onTrigger }`. Right-drag reveals `leftAction`. Triggers past 56px or >0.4px/ms. Renders children plainly under reduced motion — always mirror the action in the sheet.
- `useLongPress(cb, { ms?=450, moveTolerance?=8 })` → spread onto an element; vibrates 10ms, swallows the trailing click.
- `<Toggletip label>{body}</Toggletip>` — 28px Info button, `role="dialog"`, flips above/below, closes on outside pointerdown / Escape / scroll.
- `<HintBadge storageKey label side?='top-right'>` — one-time pulsing dot; dismissed by any pointerdown in the wrapper; SSR-safe.
- `<EmptyState icon? title description? action?={label,onClick} footer?>`.
- `<BottomNav items=[{href,label,icon,badge?}]>` — active by `usePathname`, sliding pill, hides on scroll-down, auto-hidden on `/login|/access-denied|/about|/privacy|/terms`. Give scroll containers `.pb-nav`.
- `<PullToRefresh onRefresh disabled?>` — touch only, engages at `scrollTop === 0`, threshold 64px, ≥500ms visible.
- `Toast` (`@/components/Toast`): `<ToastProvider>` (nesting-safe) and `useToast()` → `(message, kind?: 'success'|'error'|'info'|'default')`. Success draws its check in.

## Pure helpers (unit-tested, safe in node)

`resolveSwipe(dx, vx)` → `'left'|'right'|'none'` · `clampSwipe` · `swipeProgress` ·
`placePopover(anchorRect, size, viewport)` → `{top,left,side}` ·
`longPressReducer(state, event, opts)` · `scrollDirectionReducer(state, y)` ·
`hintStorageKey(id)` / `isHintDismissed` / `dismissHint` / `resetHint`.

## Deviation to know about

`domAnimation` has no layout animations, so `layoutId` is replaced by `useSlidingIndicator(activeKey)`
(measure + animate `x/y/width/height`). Use it for any new sliding indicator; do not switch to `domMax`.
`domAnimation` itself is loaded after hydration (measured 11 KB cheaper than eager), so `m.*` elements
render statically for the first frames — never rely on an entry animation for legibility.
The toast success check is CSS (`.draw-check`), not `m.path`, for the same reason.
