import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The adapter's whole job is "pass the right duration and never `Infinity`",
 * and the second Chrome pass found toasts that never went away — so the
 * durations are asserted here rather than assumed. sonner is mocked: nothing
 * in this file renders.
 */
type Options = { duration?: number; icon?: unknown };

type Toaster = (message: string, options?: Options) => string;

const base = vi.fn<Toaster>(() => 'id-default');
const success = vi.fn<Toaster>(() => 'id-success');
const error = vi.fn<Toaster>(() => 'id-error');
const dismiss = vi.fn<(id?: string | number) => void>();

vi.mock('sonner', () => {
  const toast = Object.assign(base, { success, error, dismiss, info: vi.fn(), warning: vi.fn() });
  return { toast, Toaster: () => null };
});

const { showToast, toastDuration } = await import('@/components/Toast');

describe('toastDuration', () => {
  it('gives errors longer than acknowledgements', () => {
    expect(toastDuration('error')).toBe(4000);
    expect(toastDuration('success')).toBe(2500);
    expect(toastDuration('info')).toBe(2500);
    expect(toastDuration('default')).toBe(2500);
  });

  it('is never Infinity — sonner skips the close timer for that value', () => {
    for (const kind of ['success', 'error', 'info', 'default'] as const) {
      expect(Number.isFinite(toastDuration(kind))).toBe(true);
    }
  });
});

describe('showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    base.mockClear();
    success.mockClear();
    error.mockClear();
    dismiss.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes 4000ms to sonner.error', () => {
    showToast('nope', 'error');
    expect(error).toHaveBeenCalledWith('nope', expect.objectContaining({ duration: 4000 }));
  });

  it('passes 2500ms to sonner.success, alongside the drawn check', () => {
    showToast('pinned', 'success');
    expect(success).toHaveBeenCalledWith('pinned', expect.objectContaining({ duration: 2500 }));
    expect(success.mock.calls[0]?.[1]).toHaveProperty('icon');
  });

  it('passes 2500ms to the plain toast', () => {
    showToast('copied');
    expect(base).toHaveBeenCalledWith('copied', expect.objectContaining({ duration: 2500 }));
  });

  it('dismisses by hand once the grace period is up, whatever sonner’s paused timer thinks', () => {
    showToast('copied');
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2500 + 4000);
    expect(dismiss).toHaveBeenCalledWith('id-default');
  });
});
