import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MIME,
  buildSearchQuery,
  escapeQ,
  exportTarget,
  kindFromMime,
  sanitizeClientName,
  searchFiles,
  shareFile,
  toDriveFile,
  validateHotList,
} from '../drive';
import type { HotList } from '../types';

const DRIVE_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../drive.ts');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('escapeQ', () => {
  it('escapes single quotes', () => {
    expect(escapeQ("O'Brien")).toBe("O\\'Brien");
  });

  it('escapes backslashes before quotes', () => {
    expect(escapeQ('a\\b')).toBe('a\\\\b');
    expect(escapeQ("a\\'b")).toBe("a\\\\\\'b");
  });

  it('leaves plain text alone', () => {
    expect(escapeQ('quarterly review')).toBe('quarterly review');
  });
});

describe('buildSearchQuery', () => {
  it('always constrains to own, untrashed files', () => {
    const q = buildSearchQuery('deck', 'all');
    expect(q).toContain("'me' in owners");
    expect(q).toContain('trashed = false');
    expect(q).toContain("name contains 'deck'");
    expect(q).toContain("fullText contains 'deck'");
  });

  it('excludes folders for type "all"', () => {
    expect(buildSearchQuery('x', 'all')).toContain(`mimeType != '${MIME.folder}'`);
  });

  it('filters by mime for typed searches', () => {
    expect(buildSearchQuery('x', 'slides')).toContain(`mimeType = '${MIME.slides}'`);
    expect(buildSearchQuery('x', 'docs')).toContain(`mimeType = '${MIME.docs}'`);
    expect(buildSearchQuery('x', 'pdf')).toContain(`mimeType = '${MIME.pdf}'`);
    expect(buildSearchQuery('x', 'xlsx')).toContain(`mimeType = '${MIME.xlsx}'`);
  });

  it('escapes the user query', () => {
    expect(buildSearchQuery("it's", 'all')).toContain("name contains 'it\\'s'");
  });
});

describe('kindFromMime', () => {
  it.each([
    [MIME.slides, 'slides'],
    [MIME.docs, 'docs'],
    [MIME.sheets, 'sheets'],
    [MIME.folder, 'folder'],
    [MIME.pdf, 'pdf'],
    [MIME.pptx, 'pptx'],
    [MIME.docx, 'docx'],
    [MIME.xlsx, 'xlsx'],
    ['image/png', 'other'],
    ['', 'other'],
  ])('maps %s to %s', (mime, kind) => {
    expect(kindFromMime(mime)).toBe(kind);
  });
});

describe('exportTarget', () => {
  it('maps native types to their Office equivalents', () => {
    expect(exportTarget(MIME.slides, 'native')).toEqual({ mimeType: MIME.pptx, ext: 'pptx' });
    expect(exportTarget(MIME.docs, 'native')).toEqual({ mimeType: MIME.docx, ext: 'docx' });
    expect(exportTarget(MIME.sheets, 'native')).toEqual({ mimeType: MIME.xlsx, ext: 'xlsx' });
  });

  it('maps native types to PDF when asked', () => {
    expect(exportTarget(MIME.slides, 'pdf')).toEqual({ mimeType: MIME.pdf, ext: 'pdf' });
    expect(exportTarget(MIME.sheets, 'pdf')).toEqual({ mimeType: MIME.pdf, ext: 'pdf' });
  });

  it('rejects non-native types (they are fetched with alt=media)', () => {
    expect(exportTarget(MIME.pdf, 'pdf')).toBeNull();
    expect(exportTarget(MIME.pptx, 'native')).toBeNull();
    expect(exportTarget('image/png', 'pdf')).toBeNull();
    expect(exportTarget(MIME.folder, 'native')).toBeNull();
  });
});

describe('validateHotList', () => {
  const valid: HotList = {
    version: 1,
    groups: [
      {
        id: 'g1',
        name: 'Templates',
        items: [
          {
            fileId: 'f1',
            name: 'Deck',
            mimeType: MIME.slides,
            kind: 'slides',
            webViewLink: 'https://drive.google.com/x',
          },
        ],
      },
    ],
    settings: { clientSharesFolderId: 'abc' },
  };

  it('accepts a well-formed list', () => {
    expect(validateHotList(valid)).toBe(true);
  });

  it('accepts an empty list with empty settings', () => {
    expect(validateHotList({ version: 1, groups: [], settings: {} })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a wrong version', { version: 2, groups: [], settings: {} }],
    ['missing groups', { version: 1, settings: {} }],
    ['groups not an array', { version: 1, groups: {}, settings: {} }],
    ['missing settings', { version: 1, groups: [] }],
    ['a group without an id', { version: 1, groups: [{ name: 'a', items: [] }], settings: {} }],
    [
      'a group whose items are not an array',
      { version: 1, groups: [{ id: 'g', name: 'a', items: 'x' }], settings: {} },
    ],
    [
      'an item with an unknown kind',
      {
        version: 1,
        groups: [
          {
            id: 'g',
            name: 'a',
            items: [{ fileId: 'f', name: 'n', mimeType: 'm', kind: 'nope', webViewLink: 'l' }],
          },
        ],
        settings: {},
      },
    ],
    [
      'a non-string clientSharesFolderId',
      { version: 1, groups: [], settings: { clientSharesFolderId: 7 } },
    ],
  ])('rejects %s', (_label, input) => {
    expect(validateHotList(input)).toBe(false);
  });
});

describe('sanitizeClientName', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeClientName('  Acme Ltd  ')).toBe('Acme Ltd');
  });

  it('strips path separators', () => {
    expect(sanitizeClientName('Acme/Corp\\EU')).toBe('AcmeCorpEU');
  });

  it('can reduce to the empty string', () => {
    expect(sanitizeClientName('  //  ')).toBe('');
  });
});

describe('toDriveFile', () => {
  it('parses size into a number and derives kind', () => {
    const file = toDriveFile({
      id: 'f1',
      name: 'Report.pdf',
      mimeType: MIME.pdf,
      modifiedTime: '2026-01-01T00:00:00.000Z',
      size: '1234',
      webViewLink: 'https://drive.google.com/f1',
    });
    expect(file.size).toBe(1234);
    expect(file.kind).toBe('pdf');
  });

  it('omits size for Google-native files', () => {
    const file = toDriveFile({ id: 'f2', name: 'Deck', mimeType: MIME.slides });
    expect(file.size).toBeUndefined();
    expect(file.kind).toBe('slides');
  });
});

describe('never deletes (hard rule)', () => {
  const source = readFileSync(DRIVE_SOURCE, 'utf8');

  it('contains no DELETE HTTP method', () => {
    expect(source).not.toContain("'DELETE'");
    expect(source).not.toContain('"DELETE"');
    expect(source).not.toContain('DELETE');
  });

  it('never trashes or empties the trash', () => {
    expect(source).not.toContain('trashed: true');
    expect(source).not.toContain('emptyTrash');
  });
});

describe('searchFiles (stubbed fetch)', () => {
  it('builds the expected Drive list request', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        nextPageToken: 'next-1',
        files: [
          {
            id: 'f1',
            name: 'Deck',
            mimeType: MIME.slides,
            modifiedTime: '2026-01-01T00:00:00.000Z',
            webViewLink: 'https://drive.google.com/f1',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchFiles('tok', { q: 'deck', type: 'slides', pageToken: 'p2' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(target);

    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/drive/v3/files');
    expect(url.searchParams.get('corpora')).toBe('user');
    expect(url.searchParams.get('pageSize')).toBe('25');
    expect(url.searchParams.get('orderBy')).toBe('modifiedTime desc');
    expect(url.searchParams.get('pageToken')).toBe('p2');
    expect(url.searchParams.get('q')).toBe(buildSearchQuery('deck', 'slides'));
    expect(url.searchParams.get('fields')).toContain('nextPageToken');
    expect(url.searchParams.has('supportsAllDrives')).toBe(false);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');

    expect(result.nextPageToken).toBe('next-1');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].kind).toBe('slides');
  });

  it('throws a DriveError carrying the upstream status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: { message: 'Rate limit exceeded' } }, { status: 429 }),
      ),
    );
    await expect(searchFiles('tok', { q: 'x' })).rejects.toMatchObject({
      status: 429,
      message: 'Rate limit exceeded',
    });
  });
});

describe('shareFile (stubbed fetch)', () => {
  it('creates an anyone-reader permission and returns the webViewLink', async () => {
    const fetchMock = vi.fn(async (target: string) => {
      if (target.includes('/permissions')) return Response.json({ id: 'perm1' });
      return Response.json({
        id: 'f1',
        name: 'Deck',
        mimeType: MIME.slides,
        webViewLink: 'https://drive.google.com/f1',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await shareFile('tok', 'f1', { mode: 'anyone' });

    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toContain('https://www.googleapis.com/drive/v3/files/f1/permissions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ role: 'reader', type: 'anyone' });
    expect(result.link).toBe('https://drive.google.com/f1');
  });

  it('suppresses notification emails for email shares', async () => {
    const fetchMock = vi.fn(async (target: string) => {
      if (target.includes('/permissions')) return Response.json({ id: 'perm1' });
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.pdf, webViewLink: 'link' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await shareFile('tok', 'f1', { mode: 'email', email: 'a@b.com' });

    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(target).searchParams.get('sendNotificationEmail')).toBe('false');
    expect(JSON.parse(String(init.body))).toEqual({
      role: 'reader',
      type: 'user',
      emailAddress: 'a@b.com',
    });
  });

  it('swallows a 4xx "permission already exists" response for anyone shares', async () => {
    const fetchMock = vi.fn(async (target: string) => {
      if (target.includes('/permissions')) {
        return Response.json({ error: { message: 'already exists' } }, { status: 400 });
      }
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.pdf, webViewLink: 'link' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(shareFile('tok', 'f1', { mode: 'anyone' })).resolves.toEqual({ link: 'link' });
  });
});
