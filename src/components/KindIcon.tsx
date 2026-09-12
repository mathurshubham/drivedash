'use client';

import { useState } from 'react';
import {
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Folder,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { FileKind } from '@/lib/types';

const ICONS: Record<FileKind, LucideIcon> = {
  slides: Presentation,
  pptx: Presentation,
  docs: FileText,
  docx: FileText,
  pdf: FileText,
  sheets: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  folder: Folder,
  other: FileIcon,
};

export const KIND_LABEL: Record<FileKind, string> = {
  slides: 'Slides',
  docs: 'Docs',
  sheets: 'Sheets',
  pdf: 'PDF',
  pptx: 'PPTX',
  docx: 'DOCX',
  xlsx: 'XLSX',
  folder: 'Folder',
  other: 'File',
};

/** Tailwind classes for the kind badge, one colour per FileKind. */
export const KIND_BADGE: Record<FileKind, string> = {
  slides: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  pptx: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  docs: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  docx: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  sheets: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  xlsx: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  pdf: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  folder: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  other: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};

const KIND_TINT: Record<FileKind, string> = {
  slides: 'text-amber-600 dark:text-amber-400',
  pptx: 'text-orange-600 dark:text-orange-400',
  docs: 'text-blue-600 dark:text-blue-400',
  docx: 'text-sky-600 dark:text-sky-400',
  sheets: 'text-green-600 dark:text-green-400',
  xlsx: 'text-emerald-600 dark:text-emerald-400',
  pdf: 'text-red-600 dark:text-red-400',
  folder: 'text-neutral-500 dark:text-neutral-400',
  other: 'text-neutral-500 dark:text-neutral-400',
};

export default function KindIcon({
  kind,
  iconLink,
  className = 'h-5 w-5',
}: {
  kind: FileKind;
  iconLink?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (iconLink && !broken) {
    return (
      // Drive icon URLs are remote and tiny; next/image would need remote host config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconLink}
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
        className={className}
        onError={() => setBroken(true)}
      />
    );
  }

  const Icon = ICONS[kind] ?? FileIcon;
  return <Icon aria-hidden="true" className={`${className} ${KIND_TINT[kind] ?? ''}`} />;
}
