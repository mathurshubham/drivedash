/**
 * "Has this element stopped moving yet?"
 *
 * The bottom nav animates back in over ~200ms (`BottomNav`, a motion
 * `animate={{y}}`). A transform fires no ResizeObserver and — because motion
 * drives it from JS rather than a CSS transition — no `transitionend` either,
 * so a rect read on the first frame after `showNav()` is the nav's *hidden*
 * position. That stale rect is what put the tour's cutout in the wrong place
 * on a real phone.
 *
 * `waitForStable` polls a sample of the element (its rect plus its computed
 * transform) once per animation frame and resolves as soon as the sample has
 * repeated `stableFrames` times in a row, or when `maxMs` elapses — whichever
 * comes first. It always costs at least two frames, which doubles as the
 * "await rAF twice" the measuring path needs anyway.
 *
 * Everything it touches is injectable (`read`, `schedule`, `now`) so the
 * polling logic is unit-testable in a node environment with no DOM.
 */

export interface StableSample {
  top: number;
  left: number;
  width: number;
  height: number;
  /** `getComputedStyle(el).transform`, or `'none'`. */
  transform: string;
}

export interface WaitForStableOptions {
  /** Give up and resolve after this many ms. Default 350. */
  maxMs?: number;
  /** How many identical consecutive samples count as "settled". Default 2. */
  stableFrames?: number;
  /** Sampler. Defaults to reading the element passed to `waitForStable`. */
  read?: () => StableSample | null;
  /** Frame scheduler. Defaults to `requestAnimationFrame`. */
  schedule?: (cb: () => void) => void;
  /** Clock. Defaults to `performance.now` (or `Date.now`). */
  now?: () => number;
}

export interface StableResult {
  /** True when the sample settled; false when `maxMs` ran out first. */
  settled: boolean;
  /** Frames polled, including the first. */
  frames: number;
}

/** Two samples are "the same position" when every field matches. */
export function sameSample(a: StableSample | null, b: StableSample | null): boolean {
  if (a === null || b === null) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    a.transform === b.transform
  );
}

function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function defaultSchedule(cb: () => void): void {
  if (typeof requestAnimationFrame === 'undefined') {
    setTimeout(cb, 16);
    return;
  }
  requestAnimationFrame(cb);
}

function readElement(el: Element | null): StableSample | null {
  if (!el || typeof getComputedStyle === 'undefined') return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    transform: getComputedStyle(el).transform || 'none',
  };
}

/**
 * Resolves once `el` has held the same position for `stableFrames`
 * consecutive frames, or after `maxMs`. Never rejects: a missing element or a
 * torn-down document resolves immediately with `settled: false`, because the
 * caller's job (measure something) is better done late than not at all.
 */
export function waitForStable(
  el: Element | null,
  options: WaitForStableOptions = {},
): Promise<StableResult> {
  const {
    maxMs = 350,
    stableFrames = 2,
    read = () => readElement(el),
    schedule = defaultSchedule,
    now = defaultNow,
  } = options;

  return new Promise<StableResult>((resolve) => {
    const started = now();
    let previous: StableSample | null = null;
    let repeats = 0;
    let frames = 0;

    const tick = () => {
      frames += 1;
      const sample = read();

      if (sample === null) {
        resolve({ settled: false, frames });
        return;
      }

      if (sameSample(sample, previous)) {
        repeats += 1;
        if (repeats >= stableFrames) {
          resolve({ settled: true, frames });
          return;
        }
      } else {
        repeats = 1;
      }
      previous = sample;

      if (now() - started >= maxMs) {
        resolve({ settled: false, frames });
        return;
      }
      schedule(tick);
    };

    schedule(tick);
  });
}
