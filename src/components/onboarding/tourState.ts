/**
 * Pure, injectable-storage read/write for the tour flag. Extracted out of
 * `useTour` so the storage logic is unit-testable without a DOM/localStorage.
 */

export const TOUR_STORAGE_KEY = 'dd.tour.v1';

export type TourFlag = 'done' | 'skipped';

/** Minimal localStorage-shaped interface so tests can inject a fake. */
export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function readTourState(storage: TourStorage): TourFlag | null {
  const value = storage.getItem(TOUR_STORAGE_KEY);
  return value === 'done' || value === 'skipped' ? value : null;
}

export function writeTourState(storage: TourStorage, value: TourFlag): void {
  storage.setItem(TOUR_STORAGE_KEY, value);
}

export function clearTourState(storage: TourStorage): void {
  storage.removeItem?.(TOUR_STORAGE_KEY);
}
