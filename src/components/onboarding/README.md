# Onboarding (Agent B) — wiring notes for Agent C

## 1. Tour targets

Add `data-tour="<id>"` to the element each step points at:
- `search` — the Search item in `BottomNav` (Home v2 moved search off the home page)
- `hotlist` — `HotList`'s wrapping `<section>`
- `recent` — `RecentStrip`'s wrapping `<section>`
- `nav-shares` — the Shares nav item / menu link

A missing target is skipped automatically — safe to land before every target exists.

`Spotlight` dispatches `dd:nav:show` and waits a frame before measuring each step, and holds a
`lockNav()` for the whole tour, so a step whose target lives in the bottom nav always has
something to spotlight. When the target *is* in the nav, the coachmark is forced above it; every
card is clamped to `[12px, innerHeight - 12px - env(safe-area-inset-bottom)]` vertically
(`placeCoachmark`'s `maxBottom`) and to `min(320, innerWidth - 24)` wide (`coachmarkWidth`), so
its buttons can never be cut off at the bottom of a phone.

## 2. Mounting

In the home page (`src/app/(app)/page.tsx`), render once, near the top:

```tsx
<TourLauncher hotlistEmpty={hotList?.groups.every((g) => g.items.length === 0) ?? true} />
```

Shows the "New here?" offer only when `shouldOffer && hotlistEmpty`; lazily loads `Spotlight` only once the tour actually opens.

## 3. Re-launching from the menu

Add a "Show me around" item to `TopBar`'s menu that dispatches
`window.dispatchEvent(new CustomEvent('dd:tour:start'))` (see `TOUR_START_EVENT`).
`TourLauncher` listens for it globally — no prop drilling needed.

## 4. Empty states

- `HotList.tsx`, empty `groups`: `<HotListEmpty onStartTour={...dispatch dd:tour:start...} />`
- `shares/page.tsx`, empty ledger: `<SharesEmpty />`
- `SearchResults.tsx`, no matches: `<SearchEmpty query={query} />`
- `RecentStrip.tsx`, empty: `<RecentEmpty />`

## 5. Toggletips

`tooltipCopy.ts` exports `TOOLTIP_COPY.expiryChips` / `.notifyToggle` / `.adminBlockVsRemove` — pass into Agent A's `Toggletip` next to the expiry chips, notify checkbox, and admin Block/Remove row.

## 6. First-row swipe hint

`<SwipeHint storageKey="dd.hint.swipe-pin">…first row…</SwipeHint>`.
