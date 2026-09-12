---
name: doc-sharing-tool-ui
description: DriveDash UI redesign decisions (Shelves home, search as nav tab, hand-rolled tour, motion/vaul/use-gesture/sonner, landing at /about) and the review loop the user prefers (agents build, Sonnet drives Chrome, Claude judges screenshots)

type: project
---

UI redesign shipped 2026-09-13 (PR #5). Spec lives in `DESIGN_PLAN.md` (§7 = Home v2 "Shelves").

- Home is the hot list: groups are tinted "shelves" with icon + colour persisted on `HotGroup.color/icon`; file tiles, not rows. Search is a bottom-nav tab (`/search`), not a top bar. Greeting bar instead of app name.
- Libraries chosen after research: `motion` via `LazyMotion`+`m` only, `vaul` sheet, `@use-gesture/react` swipes, `sonner` toasts, hand-rolled spotlight tour (rejected driver.js/joyride/reactour). System font stack, no webfont.
- Gesture vocabulary: tap opens, long-press opens sheet, swipe only on search rows (right = pin, left = share). No swipe between tabs.
- Landing page at `/about` (Google-registered home URL); signed-out `/` → `/about`.
- Known traps recorded in `src/components/ui/README.md`: motion `initial` hides content because features load lazily; page-enter `transform` creates a stacking context so overlays must portal to body; sonner 2 pauses timers when the tab is hidden; `Pressable` base has `relative` so children needing `absolute` must be wrapped.

- Phone polish (PR #6, 2026-09-13): bottom nav visibility is a pure `decideNavVisibility` rule set (never hides on short pages, shows near ends / on idle / when a sheet or tour is open / on `dd:nav:show`); greeting bar compact and collapses on scroll; shelf titles wrap, Manage is icon-only under 480px; recent cards content-sized. Real-device screenshots from the user drove this round.

**Why:** User found the first pass "functional but bland" and asked for a unique, polished PWA with animations, gestures, guided tour, tooltips, and a landing page.

**How to apply:** Keep the restraint (one accent, flat surfaces). For UI work, the user wants: Opus/Sonnet agents build in parallel worktrees, a Sonnet agent drives Chrome for acceptance, Claude reviews screenshots and dispatches fixes; merge with merge commits (no squash), then deploy.
