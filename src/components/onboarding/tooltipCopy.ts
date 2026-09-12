/**
 * Copy strings for Agent A's `Toggletip` primitive. Agent C wires these up:
 * e.g. `<Toggletip content={TOOLTIP_COPY.expiryChips}>` next to the expiry
 * chips row, the notify toggle, and the admin Block vs Remove row.
 */
export const TOOLTIP_COPY = {
  expiryChips:
    'Expired links are revoked next time you open the app — Google keeps the file accessible until then, so pick a shorter window for anything sensitive.',
  notifyToggle:
    'Off sends the link but skips the email — useful if you’ll share it yourself another way.',
  adminBlockVsRemove:
    'Block disables sign-in but keeps the seat, so you can reinstate them later. Remove frees the seat entirely; only available once a user is blocked.',
} as const;

export type TooltipCopyKey = keyof typeof TOOLTIP_COPY;
