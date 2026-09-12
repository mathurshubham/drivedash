import {
  Briefcase,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Home,
  Menu,
  Presentation,
  Search,
} from 'lucide-react';

/**
 * A still of Home v2 inside a device frame, for the landing hero.
 *
 * Built from plain Tailwind and hard-coded demo data rather than by importing
 * the real shelf components: the landing page is public and must stay cheap,
 * and coupling a marketing still to the live home page would mean every change
 * there is a change here too. Visual parity with DESIGN_PLAN §7 is the
 * contract, not shared code.
 */

const FRAME_W = 300;
const FRAME_H = 620;

/** Muted shelf tints, matching the §7 palette in spirit: hue, not saturation. */
const SHELVES = [
  {
    name: 'Client work',
    count: 6,
    icon: Briefcase,
    tint: 'bg-[#2450d6]/12 text-[#2450d6] dark:bg-[#5d8cff]/16 dark:text-[#5d8cff]',
    files: [
      { name: 'Acme — proposal v4', icon: FileText },
      { name: 'Q3 scope of work', icon: FileSpreadsheet },
    ],
  },
  {
    name: 'Pitches',
    count: 4,
    icon: Presentation,
    tint: 'bg-[#d97706]/14 text-[#b45309] dark:bg-[#fbbf24]/16 dark:text-[#fbbf24]',
    files: [
      { name: 'Deck — Series A', icon: Presentation },
      { name: 'One-pager', icon: FileText },
    ],
  },
] as const;

export default function PhoneMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto shrink-0 rounded-[44px] bg-[#101114] p-[10px] shadow-pop ring-1 ring-black/10 dark:ring-white/10"
      style={{ width: FRAME_W, height: FRAME_H }}
    >
      {/* Screen. `bg-bg` so the still follows the visitor's own theme. */}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px] bg-bg">
        {/* Notch. */}
        <div className="absolute left-1/2 top-2 h-[18px] w-[92px] -translate-x-1/2 rounded-full bg-[#101114]" />

        {/* Greeting bar (§7): no input, no chips. */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-9">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-fg">
              Evening, Shubham
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Friday, 13 September</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[12px] font-semibold text-white">
            S
          </span>
        </div>

        {/* Shelves. */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4">
          {SHELVES.map((shelf) => (
            <div key={shelf.name} className="rounded-md border border-subtle surface p-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${shelf.tint}`}
                >
                  <shelf.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
                  {shelf.name}
                </span>
                <span className="rounded-full surface-2 px-1.5 py-0.5 text-[10px] font-medium tabular text-muted">
                  {shelf.count}
                </span>
              </div>

              {/* 2-up tiles. */}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {shelf.files.map((file) => (
                  <div key={file.name} className="rounded-sm surface-2 p-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-sm ${shelf.tint}`}
                    >
                      <file.icon className="h-4 w-4" />
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-[10.5px] font-medium leading-snug text-fg">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Recent strip. Pushed to the bottom of the shelf area so the frame
              reads as a full screen rather than a half-empty one. */}
          <div className="mt-auto pb-1">
            <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Recent
            </p>
            <div className="flex gap-2">
              <div className="h-12 w-[88px] shrink-0 rounded-sm surface-2" />
              <div className="h-12 w-[88px] shrink-0 rounded-sm surface-2" />
              <div className="h-12 w-[88px] shrink-0 rounded-sm surface-2" />
            </div>
          </div>
        </div>

        {/* Bottom nav, Home active. */}
        <div className="mt-3 flex items-stretch border-t border-subtle bg-surface/80 px-2 pb-3 pt-2 backdrop-blur-md">
          {[
            { label: 'Home', icon: Home, active: true },
            { label: 'Search', icon: Search, active: false },
            { label: 'Shares', icon: ClipboardList, active: false },
            { label: 'Menu', icon: Menu, active: false },
          ].map((tab) => (
            <span
              key={tab.label}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-sm py-1 text-[9px] font-medium ${
                tab.active ? 'bg-accent-600/10 text-accent' : 'text-muted'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
