import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MIME,
  buildSearchQuery,
  copyForClient,
  downloadFile,
  escapeQ,
  exportTarget,
  kindFromMime,
  readHotList,
  recentFiles,
  sanitizeClientName,
  searchFiles,
  shareFile,
  toDriveFile,
  validateHotList,
} from '../drive';
import type { HotList } from '../types';

const CLIENT_SHARES_FOLDER_NAME = 'Client Shares';

const DRIVE_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../drive.ts');
const SHARES_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../shares.ts');

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
  const sharesSource = readFileSync(SHARES_SOURCE, 'utf8');

  // Regexes rather than `not.toContain('DELETE')`: the bare substring also trips
  // on prose, so it would have to be policed forever instead of catching the
  // thing that actually matters — a destructive request.
  it('issues no DELETE HTTP method in drive.ts', () => {
    expect(source).not.toMatch(/method\s*:\s*['"`]DELETE['"`]/);
  });

  it('never trashes a file', () => {
    expect(source).not.toMatch(/trashed\s*:\s*true/);
    expect(sharesSource).not.toMatch(/trashed\s*:\s*true/);
  });

  it('never empties the trash', () => {
    expect(source).not.toMatch(/emptyTrash/);
    expect(sharesSource).not.toMatch(/emptyTrash/);
  });

  it('allows exactly one DELETE in shares.ts, inside revokePermission, targeting permissions', () => {
    const matches = sharesSource.match(/method\s*:\s*['"`]DELETE['"`]/g);
    expect(matches).toHaveLength(1);

    const start = sharesSource.indexOf('export async function revokePermission');
    expect(start).toBeGreaterThan(-1);
    const fromFn = sharesSource.slice(start);
    const nextExport = fromFn.indexOf('\nexport ', 1);
    const fn = nextExport === -1 ? fromFn : fromFn.slice(0, nextExport);
    expect(fn).toMatch(/method\s*:\s*['"`]DELETE['"`]/);
    expect(fn).toContain('/permissions/');
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
    const fetchMock = vi.fn(async (target: string, init?: RequestInit) => {
      if (target.includes('/permissions')) {
        if ((init?.method ?? 'GET') === 'POST') return Response.json({ id: 'perm1' });
        return Response.json({ permissions: [] });
      }
      return Response.json({
        id: 'f1',
        name: 'Deck',
        mimeType: MIME.slides,
        webViewLink: 'https://drive.google.com/f1',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await shareFile('tok', 'f1', { mode: 'anyone' });

    const post = fetchMock.mock.calls.find(
      (call) => ((call[1] as RequestInit | undefined)?.method ?? 'GET') === 'POST',
    ) as unknown as [string, RequestInit];
    expect(post[0]).toContain('https://www.googleapis.com/drive/v3/files/f1/permissions');
    expect(JSON.parse(String(post[1].body))).toEqual({ role: 'reader', type: 'anyone' });
    expect(result.link).toBe('https://drive.google.com/f1');
    expect(result.permissionId).toBe('perm1');
    expect(result.preExisting).toBe(false);
  });

  it('sends notification emails by default and honours notify: false', async () => {
    const fetchMock = vi.fn(async (target: string) => {
      if (target.includes('/permissions')) return Response.json({ id: 'perm1' });
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.pdf, webViewLink: 'link' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await shareFile('tok', 'f1', { mode: 'email', email: 'a@b.com' });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('sendNotificationEmail')).toBe(
      'true',
    );

    fetchMock.mockClear();
    await shareFile('tok', 'f1', { mode: 'email', email: 'a@b.com', notify: false });
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(target).searchParams.get('sendNotificationEmail')).toBe('false');
    expect(JSON.parse(String(init.body))).toEqual({
      role: 'reader',
      type: 'user',
      emailAddress: 'a@b.com',
    });
  });

  it('returns preExisting when the file already has an anyone permission', async () => {
    const fetchMock = vi.fn(async (target: string, init?: RequestInit) => {
      if (target.includes('/permissions')) {
        expect((init?.method ?? 'GET') === 'POST').toBe(false);
        return Response.json({ permissions: [{ id: 'anyoneWithLink', type: 'anyone', role: 'reader' }] });
      }
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.pdf, webViewLink: 'link' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await shareFile('tok', 'f1', { mode: 'anyone' });
    expect(result).toMatchObject({ link: 'link', preExisting: true });
    expect(result.permissionId).toBeUndefined();
  });

  it('reuses a pre-existing anyone permission when the ledger already manages it', async () => {
    const fetchMock = vi.fn(async (target: string, init?: RequestInit) => {
      if (target.includes('/permissions')) {
        expect((init?.method ?? 'GET') === 'POST').toBe(false);
        return Response.json({
          permissions: [{ id: 'anyoneWithLink', type: 'anyone', role: 'reader' }],
        });
      }
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.pdf, webViewLink: 'link' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await shareFile('tok', 'f1', { mode: 'anyone' }, { hasManagedAnyone: true });
    expect(result).toMatchObject({
      link: 'link',
      preExisting: false,
      permissionId: 'anyoneWithLink',
    });
  });
});

/** The URLs passed to a stubbed fetch, in call order. */
function targets(mock: ReturnType<typeof vi.fn>): URL[] {
  return mock.mock.calls.map((call) => new URL(String(call[0])));
}

/** The first list request whose `q` matches. */
function listCall(mock: ReturnType<typeof vi.fn>, match: RegExp | string): URL {
  const found = targets(mock).find((u) => {
    if (!u.pathname.endsWith('/files')) return false;
    const q = u.searchParams.get('q') ?? '';
    return typeof match === 'string' ? q.includes(match) : match.test(q);
  });
  if (!found) throw new Error(`no list call matching ${String(match)}`);
  return found;
}

describe('own-Drive scoping (hard rule 2)', () => {
  it('recentFiles sends corpora=user and restricts to owned files', async () => {
    const fetchMock = vi.fn(async () => Response.json({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await recentFiles('tok');

    const [url] = targets(fetchMock);
    expect(url.searchParams.get('corpora')).toBe('user');
    expect(url.searchParams.get('q')).toContain("'me' in owners");
    expect(url.searchParams.get('orderBy')).toBe('viewedByMeTime desc');
    expect(url.searchParams.has('spaces')).toBe(false);
  });

  it('the Client Shares folder lookup sends corpora=user and restricts to owned files', async () => {
    const fetchMock = vi.fn(async (target: string) => {
      if (target.includes('/files/f1/copy')) {
        return Response.json({ id: 'copy1', name: 'Acme - Deck', mimeType: MIME.slides });
      }
      if (new URL(target).pathname.endsWith('/files') && new URL(target).searchParams.has('q')) {
        return Response.json({ files: [{ id: 'folder1' }] });
      }
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.slides });
    });
    vi.stubGlobal('fetch', fetchMock);

    await copyForClient(
      'tok',
      'f1',
      { clientName: 'Acme', share: 'none' },
      { version: 1, groups: [], settings: {} },
    );

    const lookup = listCall(fetchMock, `name = '${CLIENT_SHARES_FOLDER_NAME}'`);
    expect(lookup.searchParams.get('corpora')).toBe('user');
    expect(lookup.searchParams.get('q')).toContain("'me' in owners");
    expect(lookup.searchParams.get('q')).toContain("'root' in parents");
  });

  it('the appDataFolder lookup uses spaces and drops corpora / owners', async () => {
    const fetchMock = vi.fn(async () => Response.json({ files: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await readHotList('tok');

    const [url] = targets(fetchMock);
    expect(url.searchParams.get('spaces')).toBe('appDataFolder');
    expect(url.searchParams.has('corpora')).toBe(false);
    expect(url.searchParams.get('q')).toBe("name = 'hotlist.json' and trashed = false");
    expect(url.searchParams.get('q')).not.toContain("'me' in owners");
  });
});

describe('downloadFile (stubbed fetch)', () => {
  it('rejects folders before fetching any media', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'fold1', name: 'Clients', mimeType: MIME.folder }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFile('tok', 'fold1', 'native')).rejects.toMatchObject({
      status: 400,
      message: 'Folders cannot be downloaded',
    });
    // Only the metadata GET; no export and no alt=media.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(targets(fetchMock)[0].searchParams.has('alt')).toBe(false);
  });
});

describe('list mapping robustness', () => {
  it('drops entries without a string id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          files: [
            { name: 'No id', mimeType: MIME.pdf },
            { id: 42, name: 'Numeric id', mimeType: MIME.pdf },
            { id: 'f1', name: 'Good', mimeType: MIME.pdf },
          ],
        }),
      ),
    );

    const result = await searchFiles('tok', { q: 'x' });
    expect(result.files.map((f) => f.id)).toEqual(['f1']);
  });

  it('falls back modifiedTime to viewedByMeTime, then the epoch', () => {
    expect(
      toDriveFile({ id: 'f1', name: 'a', mimeType: MIME.pdf, viewedByMeTime: '2026-02-02T00:00:00.000Z' })
        .modifiedTime,
    ).toBe('2026-02-02T00:00:00.000Z');
    expect(toDriveFile({ id: 'f1', name: 'a', mimeType: MIME.pdf }).modifiedTime).toBe(
      new Date(0).toISOString(),
    );
  });

  it('derives a webViewLink from the id when Drive omits it', () => {
    expect(toDriveFile({ id: 'f1', name: 'a', mimeType: MIME.pdf }).webViewLink).toBe(
      'https://drive.google.com/file/d/f1/view',
    );
  });
});

describe('copyForClient cached folder validation', () => {
  const hotlist: HotList = {
    version: 1,
    groups: [],
    settings: { clientSharesFolderId: 'cached' },
  };

  function stub(cachedMeta: Record<string, unknown>) {
    const fetchMock = vi.fn(async (target: string) => {
      const u = new URL(target);
      if (u.pathname.endsWith('/files/cached')) return Response.json(cachedMeta);
      if (u.pathname.endsWith('/files/root')) return Response.json({ id: 'real-root' });
      if (u.pathname.endsWith('/files/f1/copy')) {
        return Response.json({ id: 'copy1', name: 'Acme - Deck', mimeType: MIME.slides });
      }
      if (u.pathname.endsWith('/files') && u.searchParams.has('q')) {
        return Response.json({ files: [{ id: 'resolved' }] });
      }
      return Response.json({ id: 'f1', name: 'Deck', mimeType: MIME.slides });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const run = () =>
    copyForClient('tok', 'f1', { clientName: 'Acme', share: 'none' }, hotlist);

  it('trusts a cached folder with the right name under the real root', async () => {
    const fetchMock = stub({
      id: 'cached',
      name: 'Client Shares',
      mimeType: MIME.folder,
      trashed: false,
      parents: ['real-root'],
    });

    await expect(run()).resolves.toMatchObject({ clientSharesFolderId: 'cached' });
    expect(() => listCall(fetchMock, "name = 'Client Shares'")).toThrow();
  });

  it('re-resolves when the cached folder has the wrong name', async () => {
    stub({
      id: 'cached',
      name: 'Somebody Elses Folder',
      mimeType: MIME.folder,
      trashed: false,
      parents: ['real-root'],
    });

    await expect(run()).resolves.toMatchObject({ clientSharesFolderId: 'resolved' });
  });

  it('re-resolves when the cached folder is not under the root', async () => {
    stub({
      id: 'cached',
      name: 'Client Shares',
      mimeType: MIME.folder,
      trashed: false,
      parents: ['some-other-folder'],
    });

    await expect(run()).resolves.toMatchObject({ clientSharesFolderId: 'resolved' });
  });

  it('re-resolves when the cached folder is not a folder at all', async () => {
    stub({ id: 'cached', name: 'Client Shares', mimeType: MIME.pdf, parents: ['real-root'] });

    await expect(run()).resolves.toMatchObject({ clientSharesFolderId: 'resolved' });
  });
});
