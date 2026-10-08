import { describe, expect, it } from 'vitest';

import { treeEntries, treeOid, treeRows } from '../../src/github';

const OID = 'abc123';
// As file-tree.A.jq emits them: one frame of {oid, path, type, size}.
const FRAME = [
  { oid: OID, path: 'README.md', type: 'blob', size: 120 },
  { oid: OID, path: 'src', type: 'tree', size: null },
  { oid: OID, path: 'src/index.ts', type: 'blob', size: '42' },
  { oid: OID, path: 'src/deep', type: 'tree', size: null },
  { oid: OID, path: 'vendor/lib', type: 'commit', size: null },
  { oid: OID, path: 'README.md', type: 'blob', size: 120 },
];

describe('treeEntries', () => {
  it('reads rows or Business Text frames, skipping what is not a tree row', () => {
    expect(treeRows([FRAME, [{ fhash: 1, event: 'fileGet' }]])).toHaveLength(FRAME.length);
    expect(treeRows(FRAME)).toHaveLength(FRAME.length);
    expect(treeRows(null)).toEqual([]);
    expect(treeOid([FRAME])).toBe(OID);
    expect(treeOid([])).toBe('');
  });

  it('turns trees into folders and the rest into files, once per path', () => {
    expect(treeEntries([FRAME])).toEqual([
      { path: 'README.md', type: 'file', size: 120 },
      { path: 'src', type: 'dir' },
      { path: 'src/index.ts', type: 'file', size: 42 },
      { path: 'src/deep', type: 'dir', partial: true },
      { path: 'vendor/lib', type: 'file', size: 0 },
    ]);
  });

  it('links each entry to GitHub at the commit, and to code-server when given a host', () => {
    const [readme, src] = treeEntries([FRAME], { repo: 'kubed-io/cdn', codeServer: 'code.example.com' });
    expect(readme.href).toBe(`https://github.com/kubed-io/cdn/blob/${OID}/README.md`);
    expect(src.href).toBe(`https://github.com/kubed-io/cdn/tree/${OID}/src`);
    expect(readme.cells?.open).toMatchObject({ icon: '⌨', title: 'Open in code-server' });
    expect((src.cells?.open as { href: string }).href).toBe(
      'https://code.example.com/?folder=%2Fprojects%2Fkubed-io%2Fcdn%2Fsrc',
    );
    expect(treeEntries([FRAME])[0].cells).toBeUndefined();
  });
});
