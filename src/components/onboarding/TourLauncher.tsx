'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import TourOffer from './TourOffer';
import { TOUR_STEPS } from './tourSteps';
import { useTour } from './useTour';

const Spotlight = dynamic(() => import('./Spotlight'), { ssr: false });

/**
 * Event name used to imperatively start the tour from anywhere in the app
 * (e.g. the top-bar "Show me around" menu item) without prop-drilling a
 * `startTour` callback down to it. Dispatch with:
 *
 *   window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))
 */
export const TOUR_START_EVENT = 'dd:tour:start';

export interface TourLauncherProps {
  /** True once the hot list has loaded and has zero pinned items. */
  hotlistEmpty: boolean;
}

/**
 * Mounts the tour offer card (first sign-in, empty hot list, flag unset) and
 * the Spotlight overlay (dynamically imported, never in the initial bundle).
 * Mount once, near the top of the home page tree.
 */
export default function TourLauncher({ hotlistEmpty }: TourLauncherProps) {
  const tour = useTour();

  useEffect(() => {
    if (tour.shouldOffer && hotlistEmpty) tour.offer();
    // Only re-evaluate when the inputs that decide whether to offer change;
    // `tour.offer` is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.shouldOffer, hotlistEmpty]);

  useEffect(() => {
    const onStart = () => tour.start();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {tour.offered ? <TourOffer onStart={tour.start} onNotNow={tour.dismiss} /> : null}
      <Spotlight
        steps={TOUR_STEPS}
        open={tour.open}
        onClose={(completed) => (completed ? tour.complete() : tour.dismiss())}
      />
    </>
  );
}
