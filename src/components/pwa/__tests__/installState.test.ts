import { describe, expect, it } from 'vitest';

import {
  INSTALL_STORAGE_KEY,
  VISITS_STORAGE_KEY,
  decideInstallHint,
  isInstallMenuEligible,
  readInstallFlag,
  readVisitCount,
  recordVisit,
  writeInstallFlag,
  type DecideInstallHintInput,
  type InstallStorage,
} from '../installState';

function fakeStorage(initial: Record<string, string> = {}): InstallStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** All-eligible baseline; each test flips exactly the input(s) it's checking. */
const ELIGIBLE: DecideInstallHintInput = {
  isStandalone: false,
  installFlag: null,
  visitCount: 2,
  tourFlagSet: true,
  elapsedMs: 3000,
  hasInstallEvent: false,
  isIOSUA: false,
  isCoarsePointer: false,
};

describe('decideInstallHint', () => {
  it('never shows once running standalone', () => {
    expect(decideInstallHint({ ...ELIGIBLE, isStandalone: true, isIOSUA: true })).toBe('none');
  });

  it('never shows once dismissed', () => {
    expect(decideInstallHint({ ...ELIGIBLE, installFlag: 'dismissed', isIOSUA: true })).toBe('none');
  });

  it('never shows once installed', () => {
    expect(decideInstallHint({ ...ELIGIBLE, installFlag: 'installed', isIOSUA: true })).toBe('none');
  });

  it('stays hidden on a first visit', () => {
    expect(decideInstallHint({ ...ELIGIBLE, visitCount: 1, isIOSUA: true })).toBe('none');
  });

  it('stays hidden while the tour flag is unset', () => {
    expect(decideInstallHint({ ...ELIGIBLE, tourFlagSet: false, isIOSUA: true })).toBe('none');
  });

  it('stays hidden before the 3s delay has elapsed', () => {
    expect(decideInstallHint({ ...ELIGIBLE, elapsedMs: 2999, isIOSUA: true })).toBe('none');
  });

  it('detects iOS Safari (no captured event)', () => {
    expect(decideInstallHint({ ...ELIGIBLE, isIOSUA: true })).toBe('ios-safari');
  });

  it('detects android-chrome from a captured event on a coarse pointer', () => {
    expect(
      decideInstallHint({ ...ELIGIBLE, hasInstallEvent: true, isCoarsePointer: true }),
    ).toBe('android-chrome');
  });

  it('detects desktop from a captured event on a fine pointer', () => {
    expect(
      decideInstallHint({ ...ELIGIBLE, hasInstallEvent: true, isCoarsePointer: false }),
    ).toBe('desktop');
  });

  it('never shows with neither a captured event nor an iOS UA', () => {
    expect(decideInstallHint(ELIGIBLE)).toBe('none');
  });

  it('prefers the captured event over UA sniffing when both are true', () => {
    expect(
      decideInstallHint({ ...ELIGIBLE, hasInstallEvent: true, isCoarsePointer: true, isIOSUA: true }),
    ).toBe('android-chrome');
  });
});

describe('readInstallFlag / writeInstallFlag', () => {
  it('reads null when unset', () => {
    expect(readInstallFlag(fakeStorage())).toBeNull();
  });

  it('reads null for a garbage value', () => {
    expect(readInstallFlag(fakeStorage({ [INSTALL_STORAGE_KEY]: 'garbage' }))).toBeNull();
  });

  it('round-trips "dismissed"', () => {
    const storage = fakeStorage();
    writeInstallFlag(storage, 'dismissed');
    expect(readInstallFlag(storage)).toBe('dismissed');
  });

  it('round-trips "installed"', () => {
    const storage = fakeStorage();
    writeInstallFlag(storage, 'installed');
    expect(readInstallFlag(storage)).toBe('installed');
  });
});

describe('readVisitCount / recordVisit', () => {
  it('defaults to 0 when unset', () => {
    expect(readVisitCount(fakeStorage())).toBe(0);
  });

  it('treats a garbage value as 0', () => {
    expect(readVisitCount(fakeStorage({ [VISITS_STORAGE_KEY]: 'nope' }))).toBe(0);
  });

  it('treats a negative value as 0', () => {
    expect(readVisitCount(fakeStorage({ [VISITS_STORAGE_KEY]: '-3' }))).toBe(0);
  });

  it('increments from 0 to 1 and persists it', () => {
    const storage = fakeStorage();
    expect(recordVisit(storage)).toBe(1);
    expect(readVisitCount(storage)).toBe(1);
  });

  it('accumulates across calls', () => {
    const storage = fakeStorage({ [VISITS_STORAGE_KEY]: '1' });
    expect(recordVisit(storage)).toBe(2);
    expect(recordVisit(storage)).toBe(3);
    expect(readVisitCount(storage)).toBe(3);
  });
});

describe('isInstallMenuEligible', () => {
  it('is false once standalone, even with a captured event or iOS UA', () => {
    expect(
      isInstallMenuEligible({ hasInstallEvent: true, isIOSUA: true, isStandalone: true }),
    ).toBe(false);
  });

  it('is true with a captured event', () => {
    expect(
      isInstallMenuEligible({ hasInstallEvent: true, isIOSUA: false, isStandalone: false }),
    ).toBe(true);
  });

  it('is true on an iOS UA with no event', () => {
    expect(
      isInstallMenuEligible({ hasInstallEvent: false, isIOSUA: true, isStandalone: false }),
    ).toBe(true);
  });

  it('is false with neither', () => {
    expect(
      isInstallMenuEligible({ hasInstallEvent: false, isIOSUA: false, isStandalone: false }),
    ).toBe(false);
  });
});
