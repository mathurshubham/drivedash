/**
 * Data for the 4-step first-run guided tour (DESIGN_PLAN.md §3).
 *
 * `target` matches a `data-tour="<target>"` attribute placed on the element to
 * spotlight. Home v2 moved search off the home page, so step 1 now points at
 * the Search item in the bottom nav (`data-tour="search"`, set by `AppShell`)
 * rather than an input in the header. `placement` is a hint consumed by `placeCoachmark`:
 * 'auto' picks above/below based on available space, 'top'/'bottom' force a
 * side (still clamped to the viewport).
 */
export interface TourStep {
  id: string;
  target: string;
  title: string;
  body: string;
  placement: 'auto' | 'top' | 'bottom';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'search',
    target: 'search',
    title: 'Search your whole Drive from the Search tab',
    body: 'Tap Search in the bottom bar. Chips filter by type, so you can jump straight to Docs, Sheets, or Slides.',
    placement: 'top',
  },
  {
    id: 'hotlist',
    target: 'hotlist',
    title: 'Pin files you use on the move',
    body: 'Long-press any file, or swipe right in Search, to pin it to a shelf here.',
    placement: 'auto',
  },
  {
    id: 'recent',
    target: 'recent',
    title: 'Recently opened',
    body: 'Always one tap away, no digging through folders.',
    placement: 'auto',
  },
  {
    id: 'nav-shares',
    target: 'nav-shares',
    title: 'Every link, logged',
    body: 'Every link you share is logged here, with expiry. Revoke any time.',
    placement: 'top',
  },
];
