import { describe, expect, it } from 'vitest';

import {
  activityByHash,
  activityStats,
  claudeEdits,
  lineCount,
  lineDiff,
  pathHash,
  projectPrefixes,
  withActivity,
  withStats,
} from '../../src/github';
import { staticProvider, type Entry } from '../../src/kd/files';

const REPO = 'kubed-io/cdn';
const PREFIXES = projectPrefixes(REPO);
const hit = (abs: string, event: string, n: number, key = 'Value #A') => ({ fhash: String(pathHash(abs)), event, [key]: n });
const claude = (tool: string, input: unknown) => ({
  Line: 'claude_code.tool_result',
  labels: JSON.stringify({ tool_name: tool, tool_input: typeof input === 'string' ? input : JSON.stringify(input) }),
});

describe('code-server activity', () => {
  it('counts both checkouts of a repository', () => {
    expect(PREFIXES).toEqual(['/projects/kubed-io/cdn/', '/projects/cdn/']);
    expect(projectPrefixes('solo', '/srv/')).toEqual(['/srv/solo/']);
  });

  it('sums events per hash and joins them to paths', () => {
    const frames = [
      [
        hit('/projects/kubed-io/cdn/README.md', 'fileGet', 2),
        hit('/projects/cdn/README.md', 'fileGet', 1, 'Value'),
        hit('/projects/cdn/README.md', 'editorOpened', 5),
        hit('/projects/kubed-io/cdn/src/a.ts', 'filePUT', 3),
        { fhash: '', event: 'fileGet', value: 9 },
        hit('/projects/kubed-io/cdn/src/a.ts', 'somethingElse', 4),
      ],
    ];
    expect(activityByHash(frames).get(pathHash('/projects/cdn/README.md'))).toEqual({ opened: 1, viewed: 5, saved: 0 });
    expect(activityStats(frames, ['README.md', 'src/a.ts', 'other'], PREFIXES)).toEqual({
      'README.md': { opened: 3, viewed: 5, saved: 0 },
      'src/a.ts': { opened: 0, viewed: 0, saved: 3 },
    });
  });
});

describe('line diff', () => {
  it('counts lines, a final newline not adding one', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('a\nb\n')).toBe(2);
    expect(lineCount('a\nb')).toBe(2);
  });

  it('counts added and removed lines by common subsequence', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([2, 1]);
    expect(lineDiff('', 'x\ny')).toEqual([2, 0]);
    expect(lineDiff('x', '')).toEqual([0, 1]);
    expect(lineDiff('same', 'same')).toEqual([0, 0]);
  });

  it('counts everything as replaced past 250 000 line pairs', () => {
    const big = Array.from({ length: 600 }, (_, i) => `l${i}`).join('\n');
    expect(lineDiff(big, big)).toEqual([600, 600]);
  });
});

describe("Claude Code's edits", () => {
  it('diffs Edit and MultiEdit, counts Write as added, keyed by repository path', () => {
    const rows = [
      claude('Edit', { file_path: '/projects/kubed-io/cdn/src/a.ts', old_string: 'a\nb', new_string: 'a\nc\nd' }),
      claude('MultiEdit', {
        file_path: '/projects/cdn/src/a.ts',
        edits: [
          { old_string: 'x', new_string: 'y' },
          { old_string: 'p\nq', new_string: 'p' },
        ],
      }),
      claude('Write', { file_path: '/projects/kubed-io/cdn/NEW.md', content: 'one\ntwo\nthree\n' }),
      claude('Read', { file_path: '/projects/kubed-io/cdn/src/a.ts' }),
      claude('Edit', { file_path: '/elsewhere/a.ts', old_string: 'a', new_string: 'b' }),
      { fhash: '1', event: 'fileGet' },
    ];
    expect(claudeEdits([rows], PREFIXES)).toEqual({
      'src/a.ts': { added: 3, removed: 3, edits: 2, estimated: 0 },
      'NEW.md': { added: 3, removed: 0, edits: 1, estimated: 0 },
    });
  });

  it('estimates a cut-off input and flags it', () => {
    const edit = '{"file_path":"/projects/cdn/big.ts","old_string":"a\\nb","new_string":"c\\nd\\ne…[700 chars]';
    const write = '{"file_path":"/projects/cdn/w.ts","content":"1\\n2…[140 chars]';
    expect(claudeEdits([claude('Edit', edit), claude('Write', write)], PREFIXES)).toEqual({
      'big.ts': { added: 13, removed: 2, edits: 1, estimated: 1 },
      'w.ts': { added: 4, removed: 0, edits: 1, estimated: 1 },
    });
  });

  it('accepts labels as an object and skips unreadable ones', () => {
    const rows = [
      { Line: 'x', labels: { tool_name: 'Write', tool_input: JSON.stringify({ file_path: '/projects/cdn/a', content: 'z' }) } },
      { Line: 'x', labels: '{not json' },
    ];
    expect(claudeEdits(rows, PREFIXES)).toEqual({ a: { added: 1, removed: 0, edits: 1, estimated: 0 } });
  });
});

describe('stats on entries', () => {
  const entries: Entry[] = [
    { path: 'src', type: 'dir' },
    { path: 'src/a.ts', type: 'file', size: 10, stats: { opened: 1 } },
    { path: 'README.md', type: 'file', size: 5 },
  ];

  it('merges numbers into files only, leaving the rest untouched', () => {
    const out = withStats(entries, { 'src/a.ts': { opened: 2, saved: 1 }, src: { opened: 9 } }, { 'src/a.ts': { added: 4, flag: 'x' } });
    expect(out[0]).toBe(entries[0]);
    expect(out[1].stats).toEqual({ opened: 3, saved: 1, added: 4 });
    expect(out[2]).toBe(entries[2]);
    expect(entries[1].stats).toEqual({ opened: 1 });
  });

  it('joins both sources in one call, ready for folder roll-ups', async () => {
    const frames = [
      [hit('/projects/cdn/src/a.ts', 'filePUT', 2)],
      [claude('Edit', { file_path: '/projects/kubed-io/cdn/README.md', old_string: 'a', new_string: 'b' })],
    ];
    const out = withActivity(entries, frames, REPO);
    expect(out[1].stats).toEqual({ opened: 1, viewed: 0, saved: 2 });
    expect(out[2].stats).toEqual({ added: 1, removed: 1, edits: 1, estimated: 0 });
    const root = await staticProvider(out).list('');
    expect(root.find((e) => e.path === 'src')?.stats).toEqual({ opened: 1, viewed: 0, saved: 2 });
  });
});
