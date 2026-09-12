'use client';

import type { ElementType, ReactNode } from 'react';
import { useReveal } from '@/components/landing/useReveal';

export interface RevealProps {
  /** Element to render. Sections stay sections, list items stay list items. */
  as?: ElementType;
  /** Staggers a group: 0 for the first child, 1 for the second, … */
  index?: number;
  className?: string;
  children: ReactNode;
}

/** Per-step stagger. Small enough to read as one movement, not a queue. */
const STEP_MS = 70;

/**
 * Fades and lifts its children into place the first time they scroll into
 * view. The only client component on the landing page; everything inside it
 * stays a server component.
 */
export default function Reveal({
  as: Tag = 'div',
  index = 0,
  className = '',
  children,
}: RevealProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      // Inline because the delay is per instance; the reduced-motion rule in
      // globals.css drops the transition entirely, so this becomes inert.
      style={index ? { transitionDelay: `${index * STEP_MS}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
