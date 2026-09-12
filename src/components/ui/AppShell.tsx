'use client';

import type { ReactNode } from 'react';
import MotionProvider from '@/components/ui/MotionProvider';
import { ToastProvider } from '@/components/Toast';

/**
 * Client half of `(app)/layout.tsx`: the providers every signed-in screen
 * needs. `BottomNav` is deliberately not mounted here — it needs the admin
 * flag to decide on the Users tab, which is page-level work.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <ToastProvider>{children}</ToastProvider>
    </MotionProvider>
  );
}
