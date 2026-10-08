import { describe, expect, it } from 'vitest';

import { blobUrl, codeServerUrl, rawUrl, readmeBase, treeUrl } from '../../src/github';

const OID = '3eb1257aa0c9d0e1f2a3b4c5d6e7f8091a2b3c4d';

describe('GitHub URLs', () => {
  it('point at a file, a folder and raw bytes at a ref, each segment encoded', () => {
    expect(blobUrl('kubed-io/cdn', OID, 'docs/a b/#1.md')).toBe(`https://github.com/kubed-io/cdn/blob/${OID}/docs/a%20b/%231.md`);
    expect(treeUrl('kubed-io/cdn', 'main', 'src/kd')).toBe('https://github.com/kubed-io/cdn/tree/main/src/kd');
    expect(treeUrl('kubed-io/cdn', 'main')).toBe('https://github.com/kubed-io/cdn/tree/main');
    expect(rawUrl('kubed-io/cdn', 'feature/x', 'img/ü.png')).toBe(
      'https://raw.githubusercontent.com/kubed-io/cdn/feature/x/img/%C3%BC.png',
    );
  });

  it('give a README bases at the commit it was read at, in its folder', () => {
    expect(readmeBase('kubed-io/cdn', OID)).toEqual({
      links: `https://github.com/kubed-io/cdn/blob/${OID}/`,
      images: `https://raw.githubusercontent.com/kubed-io/cdn/${OID}/`,
    });
    expect(readmeBase('kubed-io/cdn', OID, 'docs/guide').links).toBe(`https://github.com/kubed-io/cdn/blob/${OID}/docs/guide/`);
    const base = readmeBase('kubed-io/cdn', OID, 'docs');
    expect(new URL('../img/logo.png', base.images).href).toBe(`https://raw.githubusercontent.com/kubed-io/cdn/${OID}/img/logo.png`);
  });
});

describe('codeServerUrl', () => {
  it('opens a file in the repository workspace, naming the host in the payload', () => {
    const url = new URL(codeServerUrl('code.example.com', 'kubed-io/cdn', 'src/kd/index.ts'));
    expect(url.origin).toBe('https://code.example.com');
    expect(url.searchParams.get('folder')).toBe('/projects/kubed-io/cdn');
    expect(JSON.parse(url.searchParams.get('payload') ?? '')).toEqual([
      ['openFile', 'vscode-remote://code.example.com/projects/kubed-io/cdn/src/kd/index.ts'],
    ]);
  });

  it('opens a folder, or the root, as the workspace', () => {
    expect(codeServerUrl('https://code.example.com/', 'kubed-io/cdn', 'src', { folder: true })).toBe(
      'https://code.example.com/?folder=%2Fprojects%2Fkubed-io%2Fcdn%2Fsrc',
    );
    expect(codeServerUrl('code.example.com', 'kubed-io/cdn')).toBe('https://code.example.com/?folder=%2Fprojects%2Fkubed-io%2Fcdn');
  });

  it('takes the checkout root and a port', () => {
    const url = new URL(codeServerUrl('http://localhost:8080', 'o/r', 'a.txt', { root: '/home/coder/src/' }));
    expect(url.searchParams.get('folder')).toBe('/home/coder/src/o/r');
    expect(url.searchParams.get('payload')).toContain('vscode-remote://localhost:8080/home/coder/src/o/r/a.txt');
  });
});
