// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { pathHash } from '../../src/github/hash';

// The Repo dashboard's two originals, verbatim: file-tree.helpers.js's hash()
// and variables/state.yaml's jq `def h` (the fhashes variable).
const original = (s: string) => {
  let h = ((0 << 5) - 0 + 149417) | 0;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
};
const JQ_H =
  'def h: reduce explode[] as $ch (149417; ((. * 31 + $ch) % 4294967296 + 4294967296) % 4294967296 ' +
  '| if . >= 2147483648 then . - 4294967296 else . end);';
// The jq hashes code points where VS Code hashes UTF-16 code units, so it
// splits a character outside the BMP into its surrogate pair first.
const JQ_H_UTF16 =
  'def h: reduce (explode[] | if . >= 65536 then (. - 65536) as $u | (55296 + ($u / 1024 | floor), 56320 + ($u % 1024)) ' +
  'else . end) as $ch (149417; ((. * 31 + $ch) % 4294967296 + 4294967296) % 4294967296 ' +
  '| if . >= 2147483648 then . - 4294967296 else . end);';

// Computed with both originals (node, jq 1.7) on 2026-10-08.
const VECTORS: [string, number][] = [
  ['', 149417],
  ['a', 4632024],
  ['README.md', -376329138],
  ['/projects/kubed-io/cdn/src/kd/files/explorer.ts', 1052893521],
  ['/projects/cdn/package.json', 1258493505],
  ['/projects/kubed-io/github/dashboard/tabs/files/src/file-tree.helpers.js', -1647532190],
  ['docs/café/naïve résumé.md', -131789256],
  ['文档/说明.md', -2007978495],
  ['Ωμέγα/файл.txt', -2054825872],
  [
    'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/0123456789-very-long-path-segment-to-force-many-wraps.yaml',
    1864132438,
  ],
];
// Outside the BMP the JS original (and VS Code) and the jq original disagree.
const ASTRAL: [string, number, number][] = [
  ['emoji/🚀 launch.md', 4418119, -544828608],
  ['𝄞/a', -2040911323, 270742375],
];

const jq = (program: string, paths: string[]): number[] =>
  JSON.parse(execFileSync('jq', ['-c', `${program} map(h)`], { input: JSON.stringify(paths), encoding: 'utf8' }));
const hasJq = (() => {
  try {
    execFileSync('jq', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

describe('pathHash', () => {
  it.each(VECTORS)('%j hashes to %d', (path, want) => {
    expect(pathHash(path)).toBe(want);
    expect(original(path)).toBe(want);
  });

  it.each(ASTRAL)('%j hashes by UTF-16 code unit, as VS Code does', (path, want) => {
    expect(pathHash(path)).toBe(want);
    expect(original(path)).toBe(want);
  });

  it('is a signed 32-bit integer', () => {
    for (const path of ['x'.repeat(1000), '￿'.repeat(50)]) {
      const h = pathHash(path);
      expect(Number.isInteger(h) && h >= -(2 ** 31) && h < 2 ** 31).toBe(true);
      expect(h).toBe(original(path));
    }
  });
});

describe.skipIf(!hasJq)("the dashboard's jq", () => {
  it('agrees inside the BMP', () => {
    expect(jq(JQ_H, VECTORS.map(([p]) => p))).toEqual(VECTORS.map(([, h]) => h));
  });

  it('disagrees outside it, which the UTF-16 variant fixes', () => {
    const paths = ASTRAL.map(([p]) => p);
    expect(jq(JQ_H, paths)).toEqual(ASTRAL.map(([, , h]) => h));
    expect(jq(JQ_H_UTF16, [...paths, ...VECTORS.map(([p]) => p)])).toEqual([
      ...ASTRAL.map(([, h]) => h),
      ...VECTORS.map(([, h]) => h),
    ]);
  });
});
