import { describe, expect, it } from 'vitest';

import { dirname, formatSize, normalizePath, staticProvider, type Entry } from '../../src/kd/files';

const ENTRIES: Entry[] = [
  { path: 'README.md', type: 'file', size: 100, stats: { opened: 1 }, modified: '2026-10-01T00:00:00Z' },
  { path: 'src/kd/a.ts', type: 'file', size: 10, stats: { opened: 2, saved: 1 }, modified: '2026-10-05T00:00:00Z' },
  { path: 'src/kd/b.ts', type: 'file', size: 20, stats: { saved: 4 } },
  { path: '/src/top.ts/', type: 'file', size: 5, modified: 1759000000000 },
  { path: 'src/deep', type: 'dir', partial: true, href: 'https://example.com/deep' },
  { path: 'docs', type: 'dir', size: 999, stats: { opened: 7 } },
];

describe('staticProvider', () => {
  it('lists a folder, making up the folders a path implies', async () => {
    const p = staticProvider(ENTRIES);
    expect((await p.list('')).map((e) => [e.path, e.type])).toEqual([
      ['README.md', 'file'],
      ['src', 'dir'],
      ['docs', 'dir'],
    ]);
    expect((await p.list('src')).map((e) => e.path)).toEqual(['src/kd', 'src/top.ts', 'src/deep']);
    expect((await p.list('/src/kd/')).map((e) => e.path)).toEqual(['src/kd/a.ts', 'src/kd/b.ts']);
  });

  it('rolls up size, every numeric stat and the newest modified per folder', async () => {
    const p = staticProvider(ENTRIES);
    const [, src] = await p.list('');
    expect(src).toMatchObject({ size: 35, stats: { opened: 2, saved: 5 }, modified: '2026-10-05T00:00:00Z' });
    const [kd] = await p.list('src');
    expect(kd).toMatchObject({ size: 30, stats: { opened: 2, saved: 5 } });
    const root = await p.list('');
    expect(root.reduce((n, e) => n + (e.size ?? 0), 0)).toBe(1134);
  });

  it('keeps what a folder with nothing listed below it was given', async () => {
    const p = staticProvider(ENTRIES);
    const docs = (await p.list('')).find((e) => e.path === 'docs');
    expect(docs).toMatchObject({ size: 999, stats: { opened: 7 } });
    const deep = (await p.list('src')).find((e) => e.path === 'src/deep');
    expect(deep).toMatchObject({ partial: true, href: 'https://example.com/deep' });
    expect(await p.list('src/deep')).toEqual([]);
  });

  it('rejects a folder that does not exist, or a file', async () => {
    const p = staticProvider(ENTRIES);
    await expect(p.list('nope')).rejects.toThrow('no folder nope');
    await expect(p.list('README.md')).rejects.toThrow();
  });

  it('lets a later entry for a path win, and copes with junk', async () => {
    const p = staticProvider([
      { path: 'a.txt', type: 'file', size: 1 },
      { path: 'a.txt', type: 'file', size: 2 },
      null as unknown as Entry,
      { path: '', type: 'file' },
    ]);
    expect(await p.list('')).toEqual([{ path: 'a.txt', type: 'file', size: 2 }]);
    expect(await staticProvider(undefined).list('')).toEqual([]);
  });

  it('reads only when given a reader', async () => {
    expect(staticProvider([]).read).toBeUndefined();
    expect(staticProvider([]).capabilities).toEqual({ read: false, write: false, rename: false });
    const p = staticProvider([], { read: async (path) => ({ text: `hi ${path}` }) });
    expect(p.capabilities?.read).toBe(true);
    expect(await p.read?.('x')).toEqual({ text: 'hi x' });
  });
});

describe('path helpers', () => {
  it('normalise, split and size', () => {
    expect(normalizePath('/a//b/./c/')).toBe('a/b/c');
    expect(dirname('a/b/c')).toBe('a/b');
    expect(dirname('a')).toBe('');
    expect([0, 1023, 1536, 5 * 1048576, 3 * 1073741824].map(formatSize)).toEqual(['0 B', '1023 B', '1.5 KiB', '5.0 MiB', '3.0 GiB']);
  });
});
