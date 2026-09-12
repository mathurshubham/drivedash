import { describe, expect, it } from 'vitest';

import { clearTourState, readTourState, writeTourState, TOUR_STORAGE_KEY, type TourStorage } from '../tourState';

function fakeStorage(initial: Record<string, string> = {}): TourStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('readTourState / writeTourState', () => {
  it('reads null when unset', () => {
    expect(readTourState(fakeStorage())).toBeNull();
  });

  it('reads null for a garbage value', () => {
    expect(readTourState(fakeStorage({ [TOUR_STORAGE_KEY]: 'garbage' }))).toBeNull();
  });

  it('round-trips "done"', () => {
    const storage = fakeStorage();
    writeTourState(storage, 'done');
    expect(readTourState(storage)).toBe('done');
  });

  it('round-trips "skipped"', () => {
    const storage = fakeStorage();
    writeTourState(storage, 'skipped');
    expect(readTourState(storage)).toBe('skipped');
  });

  it('clearTourState resets to unset', () => {
    const storage = fakeStorage({ [TOUR_STORAGE_KEY]: 'done' });
    clearTourState(storage);
    expect(readTourState(storage)).toBeNull();
  });
});
