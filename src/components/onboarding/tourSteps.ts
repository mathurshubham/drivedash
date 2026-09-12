/**
 * Data for the 4-step first-run guided tour (DESIGN_PLAN.md §3).
 *
 * `target` matches a `data-tour="<target>"` attribute Agent C places on the
 * element to spotlight. `placement` is a hint consumed by `placeCoachmark`:
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
    title: 'Search your whole Drive',
    body: 'Chips filter by type, so you can jump straight to Docs, Sheets, or Slides.',
    placement: 'bottom',
  },
  {
    id: 'hotlist',
    target: 'hotlist',
    title: 'Pin files you use on the move',
    body: 'Long-press any file, or swipe right, to pin it here for one-tap access.',
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
