import { describe, expect, it } from 'vitest';

import { RECENT_SEARCHES_MAX, mergeRecentSearch } from '@/lib/recentSearches';

describe('mergeRecentSearch', () => {
  it('puts the newest query first', () => {
    expect(mergeRecentSearch(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('de-duplicates case-insensitively, keeping the new spelling', () => {
    expect(mergeRecentSearch(['Invoice', 'b'], 'invoice')).toEqual(['invoice', 'b']);
  });

  it('trims the query', () => {
    expect(mergeRecentSearch([], '  deck  ')).toEqual(['deck']);
  });

  it('ignores a blank query but still caps the list', () => {
    const seven = ['1', '2', '3', '4', '5', '6', '7'];
    expect(mergeRecentSearch(seven, '   ')).toHaveLength(RECENT_SEARCHES_MAX);
  });

  it('caps at six entries, dropping the oldest', () => {
    const six = ['1', '2', '3', '4', '5', '6'];
    expect(mergeRecentSearch(six, '7')).toEqual(['7', '1', '2', '3', '4', '5']);
  });

  it('does not mutate the input list', () => {
    const list = ['a'];
    mergeRecentSearch(list, 'b');
    expect(list).toEqual(['a']);
  });
});
