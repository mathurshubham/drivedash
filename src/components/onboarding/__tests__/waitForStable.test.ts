import { describe, expect, it } from 'vitest';

import { sameSample, waitForStable, type StableSample } from '../waitForStable';

function sample(partial: Partial<StableSample> = {}): StableSample {
  return { top: 0, left: 0, width: 100, height: 56, transform: 'none', ...partial };
}

/**
 * A fake frame loop + clock. `schedule` queues the callback; `flush` drains
 * the queue, advancing the clock by one frame per tick, so the polling logic
 * runs synchronously and deterministically with no DOM and no real rAF.
 */
function harness(samples: (StableSample | null)[], frameMs = 16) {
  let time = 0;
  let index = 0;
  const queue: (() => void)[] = [];
  return {
    reads: () => index,
    now: () => time,
    schedule: (cb: () => void) => {
      queue.push(cb);
    },
    read: () => {
      // Hold the last sample once the script runs out.
      const next = samples[Math.min(index, samples.length - 1)];
      index += 1;
      return next;
    },
    async flush(maxTicks = 200) {
      for (let i = 0; i < maxTicks && queue.length > 0; i += 1) {
        const cb = queue.shift();
        time += frameMs;
        cb?.();
        // Let the promise chain inside waitForStable settle.
        await Promise.resolve();
      }
    },
  };
}

describe('sameSample', () => {
  it('is false against null', () => {
    expect(sameSample(sample(), null)).toBe(false);
    expect(sameSample(null, sample())).toBe(false);
  });

  it('compares every field, transform included', () => {
    expect(sameSample(sample(), sample())).toBe(true);
    expect(sameSample(sample(), sample({ top: 1 }))).toBe(false);
    expect(sameSample(sample(), sample({ transform: 'matrix(1, 0, 0, 1, 0, 40)' }))).toBe(false);
  });
});

describe('waitForStable', () => {
  it('resolves after two identical frames when nothing is moving', async () => {
    const h = harness([sample(), sample(), sample()]);
    const promise = waitForStable(null, { read: h.read, schedule: h.schedule, now: h.now });
    await h.flush();
    await expect(promise).resolves.toEqual({ settled: true, frames: 2 });
  });

  it('keeps polling while the transform is still changing', async () => {
    // The nav sliding in: three moving frames, then it holds still.
    const h = harness([
      sample({ top: 900, transform: 'matrix(1, 0, 0, 1, 0, 88)' }),
      sample({ top: 860, transform: 'matrix(1, 0, 0, 1, 0, 48)' }),
      sample({ top: 830, transform: 'matrix(1, 0, 0, 1, 0, 18)' }),
      sample({ top: 812, transform: 'none' }),
      sample({ top: 812, transform: 'none' }),
    ]);
    const promise = waitForStable(null, { read: h.read, schedule: h.schedule, now: h.now });
    await h.flush();
    await expect(promise).resolves.toEqual({ settled: true, frames: 5 });
  });

  it('also waits out a rect that moves while the transform reads "none"', async () => {
    const h = harness([
      sample({ top: 900 }),
      sample({ top: 850 }),
      sample({ top: 812 }),
      sample({ top: 812 }),
    ]);
    const promise = waitForStable(null, { read: h.read, schedule: h.schedule, now: h.now });
    await h.flush();
    await expect(promise).resolves.toEqual({ settled: true, frames: 4 });
  });

  it('gives up at maxMs rather than polling forever', async () => {
    // Never settles: every frame is a new position.
    let n = 0;
    const h = harness([]);
    const promise = waitForStable(null, {
      maxMs: 96,
      read: () => sample({ top: (n += 1) }),
      schedule: h.schedule,
      now: h.now,
    });
    await h.flush();
    const result = await promise;
    expect(result.settled).toBe(false);
    // 96ms at 16ms a frame — the budget, not the whole script.
    expect(result.frames).toBe(6);
  });

  it('resolves immediately, unsettled, when the element is gone', async () => {
    const h = harness([null]);
    const promise = waitForStable(null, { read: h.read, schedule: h.schedule, now: h.now });
    await h.flush();
    await expect(promise).resolves.toEqual({ settled: false, frames: 1 });
  });

  it('honours a custom stableFrames count', async () => {
    const h = harness([sample(), sample(), sample(), sample()]);
    const promise = waitForStable(null, {
      stableFrames: 4,
      read: h.read,
      schedule: h.schedule,
      now: h.now,
    });
    await h.flush();
    await expect(promise).resolves.toEqual({ settled: true, frames: 4 });
  });
});
