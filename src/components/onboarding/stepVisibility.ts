/**
 * Pure step-skipping logic for the Spotlight tour: a target might not be on
 * the page (e.g. `nav-shares` when the bottom nav is hidden), in which case
 * that step is skipped automatically. Kept generic and DOM-free so it can be
 * unit tested directly; `Spotlight` supplies `hasTarget` backed by
 * `document.querySelector`.
 */

/**
 * Returns the index of the next step (searching from `fromIndex` in
 * `direction`) for which `hasTarget` is true, or -1 if none remain in that
 * direction. Call with `fromIndex: -1, direction: 1` to find the first
 * visible step.
 */
export function nextVisibleStep<T>(
  steps: readonly T[],
  hasTarget: (step: T) => boolean,
  fromIndex: number,
  direction: 1 | -1 = 1,
): number {
  let i = fromIndex + direction;
  while (i >= 0 && i < steps.length) {
    if (hasTarget(steps[i])) return i;
    i += direction;
  }
  return -1;
}
