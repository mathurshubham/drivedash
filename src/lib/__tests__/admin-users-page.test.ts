/**
 * The admin Users page is a client component and the test environment is `node`,
 * so these are source-level guards over the two things reviewers got wrong:
 * the KV budget readout must name the limit it colours against, and Remove must
 * only be reachable for a blocked user (removing an active one is not a ban —
 * they re-register on their next page load and take a fresh seat).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PAGE = fileURLToPath(new URL('../../app/(app)/admin/users/page.tsx', import.meta.url));
const source = readFileSync(PAGE, 'utf8');

describe('admin users page — KV budget readout', () => {
  it('shows writes against the hard limit and notes the soft-limit pause', () => {
    expect(source).toContain('KV writes today: {budget.writesToday} / {budget.hardLimit}');
    expect(source).toContain('last-seen refreshes pause after {budget.softLimit}');
    expect(source).not.toContain('{budget.writesToday} / {budget.softLimit}');
  });

  it('colours amber at the soft limit and red at the hard limit', () => {
    // Redesign (DESIGN_PLAN.md §2/§3): named danger/warn tokens replace the
    // old hand-picked Tailwind palette classes, same thresholds.
    expect(source).toMatch(
      /budget\.writesToday >= budget\.hardLimit\s*\?\s*'text-danger'\s*:\s*budget\.writesToday >= budget\.softLimit\s*\?\s*'text-warn'/,
    );
  });
});

describe('admin users page — remove is only offered for blocked users', () => {
  it('guards the Remove button on user.blocked', () => {
    // Redesign: Block/Remove moved from inline row buttons into a per-user
    // `Sheet` (DESIGN_PLAN.md §3 "Admin Users"), opened via row long-press or a
    // trailing `MoreHorizontal` button. The guard — Remove only for a blocked
    // user, two-tap confirm — is unchanged, just re-scoped to `sheetUser`.
    const removeButton = source.slice(
      source.indexOf('{sheetUser.blocked ? ('),
      source.indexOf("'Confirm remove'"),
    );
    expect(removeButton).toContain('onClick={() => void handleRemove(sheetUser)}');
    expect(source).toContain("{confirmRemove ? 'Confirm remove' : 'Remove'}");
  });

  it('explains block vs remove under the Users heading', () => {
    expect(source).toContain('Block disables sign-in but keeps the seat.');
    expect(source).toContain('an unblocked account can sign in again and take a new');
  });

  it('confirms the freed seat in the remove toast', () => {
    expect(source).toContain('toast(`Removed ${user.email}. Seat freed.`)');
  });
});

describe('admin users page — response type', () => {
  it('uses AdminUsersResponse directly, with no budget intersection', () => {
    expect(source).toContain('useState<AdminUsersResponse | null>(null)');
    expect(source).not.toContain('AdminUsersResponse & {');
  });
});
