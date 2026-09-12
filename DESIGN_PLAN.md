# DriveDash UI Redesign — Design Plan

Written 2026-09-13. Goal: turn a functional but bland mobile-first PWA into a polished one: motion, gestures, a first-run guided tour, toggletips, empty-state education, bottom navigation, skeletons, optimistic UI. Behaviour and API contracts do not change; this is a presentation layer rewrite. Read `IMPLEMENTATION_PLAN.md` §0 for stack facts (Next 16, React 19, Tailwind v4, Cloudflare Workers, lazy Auth.js proxy, `.dev.vars` gotcha).

## 0. Principles

- **Restraint.** Linear / Things 3 register: one accent, neutral surfaces, mostly flat, one shadow tier, blur only on the sheet scrim and bottom nav. No gradients as decoration.
- **Thumb first.** Primary actions live in the bottom third: bottom nav, FAB-less (the sheet is the FAB), search bar stays top but is reachable via the nav "Search" tab that focuses it.
- **Tap opens, long-press acts, swipe accelerates.** Every swipe action also exists in the long-press sheet. Nothing else claims the horizontal axis except the recent strip's own scroll. No swipe-between-tabs.
- **Motion is feedback, not decoration.** Transform/opacity only. `prefers-reduced-motion` honoured at the CSS layer and via `useReducedMotion`.
- **Teach with empty states first, tour second.** Tour is 4 steps, opt-in after first sign-in, skippable, re-launchable.
- **Bundle discipline.** `motion` only through `LazyMotion` + `m` with `domAnimation`. Tour code dynamically imported. System font stack. Measure: first-load JS for `/` must not grow more than 60 KB gzipped over today.

## 1. Libraries (add exactly these)

| Package | Use | Note |
|---|---|---|
| `motion` | `LazyMotion features={domAnimation}` + `m.*`, `AnimatePresence`, `useReducedMotion` | never import `motion` component directly |
| `vaul` | bottom sheet (Drawer) with drag handle, snap points, scrim | replaces hand-rolled ActionSheet shell; keep our content |
| `@use-gesture/react` | swipe-to-reveal on file rows, long-press | `useDrag` with axis lock, `useGesture` for long-press |
| `sonner` | toasts | replaces `src/components/Toast.tsx`; keep the `useToast()` call sites via a thin adapter |

Nothing else. No shadcn, no Radix beyond what vaul pulls, no icon packs beyond lucide.

## 2. Design tokens — `src/app/globals.css` (`@theme`)

- **Type scale** (rem, system stack): `--text-xs 0.8125` (13) · `--text-sm 0.9375` (15) · `--text-base 1.0625` (17) · `--text-lg 1.25` (20) · `--text-xl 1.5` (24). Line-heights 1.3 headings, 1.45 body. Weights 400/500/600 only. Tabular numbers for counters.
- **Spacing**: 4px base; use 2/3/4/5/6 Tailwind steps (8/12/16/20/24). Row padding 16px vertical minimum → every row ≥ 56px tall.
- **Radii**: `--radius-sm 10px` (chips, inputs), `--radius-md 14px` (cards, rows), `--radius-lg 20px` (sheet, modals), `--radius-full` pills.
- **Surfaces** (light / dark): `bg` #F7F7F8 / #0E0F12 · `surface` #FFFFFF / #16181D · `surface-2` #F1F2F4 / #1E2127 · `border` rgba(0,0,0,.08) / rgba(255,255,255,.08) · `text` #111318 / #ECEEF2 · `text-muted` #6B7280 / #9AA0AA.
- **Accent**: keep the existing blue family but recompute dark-mode: light uses `accent-600` on white, dark uses `accent-400` on `surface`. Accent appears only on: primary CTA, active nav item, pin state, selected chip, focus ring.
- **Semantic**: `success` #16A34A / #4ADE80 · `warn` #D97706 / #FBBF24 · `danger` #DC2626 / #F87171.
- **Shadow**: one tier, `--shadow-sheet: 0 -8px 30px rgba(0,0,0,.12)`; dark mode uses border instead of shadow.
- **Motion tokens**: `--dur-fast 120ms`, `--dur-base 200ms`, `--ease-out cubic-bezier(.2,.8,.2,1)`. Springs in JS: `{ type: 'spring', stiffness: 420, damping: 34 }` for sheet open; `{ stiffness: 500, damping: 40 }` for reorder.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }` plus `useReducedMotion()` gates for spring/layout animations.
- Safe-area utilities already exist; add `.pb-nav` = bottom nav height + safe-area.

## 3. Component inventory (`src/components/ui/*` new primitives, existing components re-skinned)

Primitives (Agent A):
- `MotionProvider` — `LazyMotion` wrapper mounted once in `(app)/layout.tsx`.
- `Sheet` — vaul `Drawer` with handle, snap points `[0.55, 0.92]`, scrim blur 8px, safe-area bottom padding, `AnimatePresence` for inner sub-form transitions (slide 16px + fade, 200ms).
- `Pressable` — button/anchor wrapper: `m.button` with `whileTap={{ scale: .97 }}`, min 44px, focus-visible ring, `disabled` styling. All buttons in the app use it.
- `Chip` — selectable pill with layoutId-based selection indicator (`m.span layoutId="chip-active"`).
- `Skeleton` — CSS shimmer (gradient sweep, `background-size: 200%`), variants `row`, `card`, `chip`.
- `SwipeableRow` — `useDrag` axis-x; reveals left action (Pin/Unpin, accent) at 72px, right action (Share, neutral) at 72px; snaps back; threshold 56px or velocity; `onSwipeLeft/onSwipeRight`; disables when `prefers-reduced-motion` (still tappable). Never captures vertical scroll (`axis: 'x'`, `filterTaps: true`, `pointer: { touch: true }`).
- `useLongPress` — 450ms, cancels on move > 8px, fires haptic via `navigator.vibrate?.(10)`.
- `Toggletip` — tap "i" button → popover (`role="dialog"`, `aria-expanded`), dismiss on tap-outside/Escape; positioned with `getBoundingClientRect`, flips above/below.
- `HintBadge` — one-time pulsing dot + label anchored to an element, dismissed on interaction, persisted `localStorage['dd.hint.<id>']`.
- `EmptyState` — icon, title, one sentence, optional primary action.
- `BottomNav` — Home · Shares · Users(admin only) · Menu. 56px + safe-area, blur background, active indicator via `layoutId`. Hidden on `/login`, `/access-denied`, legal pages. Hides on scroll-down, reveals on scroll-up (translateY, 200ms).
- `PullToRefresh` — hand-rolled on the home scroll container: `overscroll-behavior-y: contain`, pull indicator with rotating `RefreshCw`, threshold 64px, calls the passed `onRefresh`.
- `toast` adapter — `src/components/Toast.tsx` re-exported API over `sonner` (`useToast()` keeps `(message, kind?)` signature); success toasts show a drawn-in check (`m.path pathLength`).

Onboarding (Agent B):
- `Spotlight` tour — hand-rolled: fixed overlay with SVG mask cutout around `[data-tour="<id>"]` target (`getBoundingClientRect` + 8px padding + radius), coachmark card positioned above/below, "Skip" and "Next"/"Done" equally weighted, step dots, Escape closes, focus trapped in the card, re-measures on resize/scroll. Dynamic-imported. Steps:
  1. `search` — "Search your whole Drive. Chips filter by type."
  2. `hotlist` — "Pin files you use on the move. Long-press any file, or swipe right."
  3. `recent` — "Recently opened, always one tap away."
  4. `nav-shares` — "Every link you share is logged here, with expiry. Revoke any time."
  Trigger: first sign-in when `localStorage['dd.tour.v1']` is unset AND hot list is empty → show a small card "New here? Take a 30-second tour" with Start / Not now (Not now sets the flag too). Re-launch: Menu → "Show me around".
- Empty states: hot list ("Nothing pinned yet" + "Long-press a file, or swipe right" + tour button), shares ("No shares yet" + explanation), search no results, recent empty.
- Toggletips on: expiry chips ("Expired links are revoked next time you open the app…"), notify toggle, Block vs Remove in admin.
- First-time `HintBadge` on the first file row: "Swipe → to pin". Once.

Pages (Agent C, after A and B land):
- `(app)/layout.tsx`: `MotionProvider`, `BottomNav`, `Toaster`, page transitions with `AnimatePresence` (fade + 8px rise, 180ms) keyed by pathname; `view-transition-name` on the header as progressive enhancement.
- Home: sticky compact header (app name small, search input large with clear button), chips row → `Chip`; hot list groups as cards with collapse animation (`m.div` height auto via `AnimatePresence`), group header long-press opens group sheet (rename / move / delete); rows → `SwipeableRow` + `FileRow` (icon tile 40px rounded, name 15px/500, meta 13px muted, kind badge → small tinted tile behind the icon instead of a text badge); recent strip cards 132px with thumbnail if `thumbnailLink` else icon tile; skeletons on load; pull-to-refresh; `useOptimistic` for pin/unpin/label/move.
- Action sheet content: reorganised into two tiers: **Quick row** (4 icon buttons: Open, Pin, Share link, Copy for client) then **List** (Download, Download as PDF, Share to email, Set label, Move to group). Sub-forms slide in. Expiry chips → `Chip`. Success states animate the check.
- Shares page: segmented control Active / History (layoutId indicator), rows with left colour rail by status, Revoke two-tap becomes swipe-left → Revoke (+ button fallback), Extend as pill.
- Admin Users: seat meter as a thin progress bar under the title, rows with avatar initial tile, Block/Unblock/Remove as sheet on long-press or row menu.
- Login: full-bleed brand moment: large wordmark, one-line promise, Google button, legal links; subtle animated gradient blob behind (CSS only, disabled under reduced motion).
- Access-denied, legal pages: apply tokens, no motion beyond fade.
- Manifest: `theme_color` per token, `background_color`, add maskable icon note (icons unchanged).

## 4. Accessibility

44px targets everywhere; focus-visible rings; sheet focus trap (vaul provides); `aria-live="polite"` region for toasts (sonner provides); swipe actions mirrored in the sheet; tour card `role="dialog" aria-modal`; colour never the only signal (status rail + text).

## 5. Acceptance (tested in Chrome at 390×844, light and dark, reduced-motion on/off)

1. Home loads with skeletons then content; no layout shift > 0.05 CLS visually.
2. Long-press a row → sheet opens with spring; drag handle down → closes. Tap row → opens Drive in new tab.
3. Swipe right on a row → Pin action revealed → release → pinned, row animates into the hot list; toast with check.
4. Swipe left → Share → sheet opens on the Share sub-form.
5. Pull down on home → refresh indicator → lists reload.
6. Bottom nav: Home/Shares switch with page transition; nav hides on scroll down, returns on scroll up; Users tab only for admin.
7. First sign-in (cleared localStorage, empty hot list) → tour offer card → Start → 4 spotlight steps → Done sets flag. Skip at any step sets flag. Menu → "Show me around" restarts.
8. Toggletip on expiry chips opens on tap, closes on outside tap and Escape.
9. Reduced motion: no springs, no shimmer sweep, sheet fades, swipe disabled but buttons work.
10. Dark mode parity: every surface/token has a dark value; accent contrast ≥ 4.5:1 on its surface.
11. Gates: build, typecheck, lint, tests pass; first-load JS delta for `/` ≤ 60 KB gzipped vs `main`.

## 6. Out of scope

New features, API changes, server code, PWA offline caching, push notifications, haptics beyond `navigator.vibrate`.
