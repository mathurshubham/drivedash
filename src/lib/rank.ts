import type { DriveFile } from './types';

/**
 * Drive's `fullText contains` matches file *contents* as well as names, so a
 * search for "invoice" can return the deck that merely mentions it above the
 * file actually called "Invoice template". This re-orders one page of results
 * so name matches come first, without dropping anything.
 *
 * Tiers, best first:
 *   0 exact name (case-insensitive)
 *   1 name starts with the query
 *   2 query starts a word inside the name
 *   3 name contains the query anywhere
 *   4 no name match — a body/content hit
 *
 * Pure and stable: files in the same tier keep Drive's own order, which is
 * already relevance- or recency-sorted.
 */
export function rankResults(files: DriveFile[], query: string): DriveFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;

  const tier = (file: DriveFile): number => {
    const name = file.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    const at = name.indexOf(q);
    if (at < 0) return 4;
    // A word boundary: start of a word rather than the middle of one.
    return /[\s\-_/.([]/.test(name.charAt(at - 1)) ? 2 : 3;
  };

  return files
    .map((file, index) => ({ file, index, tier: tier(file) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.file);
}

export default rankResults;
