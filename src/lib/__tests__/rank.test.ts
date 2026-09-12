import { describe, expect, it } from 'vitest';

import { rankResults } from '@/lib/rank';
import type { DriveFile } from '@/lib/types';

function file(name: string, id = name): DriveFile {
  return {
    id,
    name,
    mimeType: 'application/vnd.google-apps.document',
    kind: 'docs',
    modifiedTime: '2026-01-01T00:00:00.000Z',
    webViewLink: `https://drive.google.com/${id}`,
  };
}

const names = (files: DriveFile[]) => files.map((f) => f.name);

describe('rankResults', () => {
  it('returns the input untouched for an empty query', () => {
    const input = [file('b'), file('a')];
    expect(rankResults(input, '   ')).toBe(input);
  });

  it('puts name matches above content-only matches', () => {
    const input = [file('Quarterly review'), file('Invoice template'), file('Meeting notes')];
    expect(names(rankResults(input, 'invoice'))).toEqual([
      'Invoice template',
      'Quarterly review',
      'Meeting notes',
    ]);
  });

  it('orders exact, prefix, word-start, then mid-word matches', () => {
    const input = [
      file('Reinvoice draft'), // mid-word
      file('Client invoice 2026'), // word start
      file('Invoice'), // exact
      file('Invoice template'), // prefix
    ];
    expect(names(rankResults(input, 'invoice'))).toEqual([
      'Invoice',
      'Invoice template',
      'Client invoice 2026',
      'Reinvoice draft',
    ]);
  });

  it('is case-insensitive', () => {
    const input = [file('zzz'), file('INVOICE')];
    expect(names(rankResults(input, 'invoice'))[0]).toBe('INVOICE');
  });

  it('is stable within a tier', () => {
    const input = [file('Invoice A'), file('Invoice B'), file('Invoice C')];
    expect(names(rankResults(input, 'invoice'))).toEqual(['Invoice A', 'Invoice B', 'Invoice C']);
  });

  it('keeps every input file', () => {
    const input = [file('a'), file('b'), file('c')];
    expect(rankResults(input, 'nothing matches')).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const input = [file('zzz'), file('Invoice')];
    const copy = [...input];
    rankResults(input, 'invoice');
    expect(input).toEqual(copy);
  });

  it('treats separators as word boundaries', () => {
    const input = [file('Draftinvoice'), file('Draft-invoice')];
    expect(names(rankResults(input, 'invoice'))[0]).toBe('Draft-invoice');
  });
});
