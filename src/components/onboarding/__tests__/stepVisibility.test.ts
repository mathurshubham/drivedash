import { describe, expect, it } from 'vitest';

import { nextVisibleStep } from '../stepVisibility';

const steps = ['search', 'hotlist', 'recent', 'nav-shares'];

describe('nextVisibleStep', () => {
  it('finds the first visible step when all targets exist', () => {
    const hasTarget = () => true;
    expect(nextVisibleStep(steps, hasTarget, -1, 1)).toBe(0);
  });

  it('skips a step whose target is missing', () => {
    const hasTarget = (s: string) => s !== 'hotlist';
    expect(nextVisibleStep(steps, hasTarget, 0, 1)).toBe(2); // skips 'hotlist' (index 1)
  });

  it('skips consecutive missing steps', () => {
    const hasTarget = (s: string) => s === 'nav-shares';
    expect(nextVisibleStep(steps, hasTarget, -1, 1)).toBe(3);
  });

  it('returns -1 when no further step has a target', () => {
    const hasTarget = (s: string) => s === 'search';
    expect(nextVisibleStep(steps, hasTarget, 0, 1)).toBe(-1);
  });

  it('returns -1 when nothing has a target at all', () => {
    const hasTarget = () => false;
    expect(nextVisibleStep(steps, hasTarget, -1, 1)).toBe(-1);
  });

  it('supports walking backwards', () => {
    const hasTarget = (s: string) => s !== 'recent';
    expect(nextVisibleStep(steps, hasTarget, 3, -1)).toBe(1); // skips 'recent' (index 2)
  });
});
