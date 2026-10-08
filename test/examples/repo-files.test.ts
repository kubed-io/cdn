import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

import * as github from '../../src/github';
import type { KdFile } from '../../src/kd/files';
import { settle, shadow } from '../kd/mount';

// The Repo dashboard's Files viewer as examples/repo-files.yaml writes it: its
// afterRender run against a stand-in for Business Text's context.
const YAML = readFileSync(join(cwd(), 'examples/repo-files.yaml'), 'utf8');

function panelOption(name: string, index: number): string {
  const all = [...YAML.matchAll(new RegExp(`^( +)${name}: (.*)$`, 'gm'))];
  const [, indent, value] = all[index];
  if (value !== '|-') return value;
  const start = (all[index].index ?? 0) + all[index][0].length + 1;
  const lines: string[] = [];
  for (const line of YAML.slice(start).split('\n')) {
    if (!line.startsWith(`${indent}  `)) break;
    lines.push(line.slice(indent.length + 2));
  }
  return lines.join('\n');
}

const viewer = {
  content: panelOption('content', 1),
  afterRender: panelOption('afterRender', 1),
};

interface Row {
  text?: string | null;
  size?: number;
  binary?: boolean;
  truncated?: boolean;
}

function render(element: HTMLElement, vars: Record<string, string>, data: Row[]): Promise<unknown> {
  const context = {
    element,
    data,
    grafana: {
      replaceVariables: (text: string) => text.replace(/\$\{(\w+)\}/g, (all, name: string) => vars[name] ?? all),
    },
  };
  const run = new Function('context', 'load', `return ${viewer.afterRender.replace(/\bimport\(/, 'load(')}`);
  return run(context, async () => github);
}

const OID = 'abc123';
const VARS = { assets: '/dist', repo: 'kubed-io/cdn', code_server: '' };

afterEach(() => document.body.replaceChildren());

describe('examples/repo-files.yaml viewer', () => {
  it('passes every key it manages, so nothing sticks from one file to the next', async () => {
    const element = document.createElement('div');
    element.innerHTML = viewer.content;
    document.body.append(element);
    const el = element.querySelector('kd-file') as KdFile;

    // A binary image previews from its raw URL, with no `type` to call it binary.
    await render(element, { ...VARS, file: `${OID}:img/logo.png` }, [{ binary: true, size: 4096, text: null }]);
    expect(el.src).toBe(`https://raw.githubusercontent.com/kubed-io/cdn/${OID}/img/logo.png`);
    expect(el.type).toBeUndefined();
    await settle(el);
    expect(shadow(el).querySelector('img.image')?.getAttribute('src')).toBe(el.src);

    // A YAML after it is code, not the PNG's leftovers.
    await render(element, { ...VARS, file: `${OID}:deploy.yaml` }, [{ text: 'a: 1\n', size: 5 }]);
    expect([el.type, el.src, el.text]).toEqual([undefined, undefined, 'a: 1\n']);
    await settle(el);
    expect(shadow(el).querySelector('kd-code')).not.toBeNull();
    expect(shadow(el).textContent).not.toContain('binary');

    // Any other binary is summarised.
    await render(element, { ...VARS, file: `${OID}:fonts/a.woff2` }, [{ binary: true, size: 10, text: null }]);
    expect([el.type, el.src, el.text]).toEqual(['binary', undefined, undefined]);

    // No file selected: the empty state, not an empty file.
    await render(element, { ...VARS, file: '' }, [{ text: null }]);
    expect([el.path, el.text, el.type, el.src, el.links, el.base]).toEqual(['', undefined, undefined, undefined, undefined, undefined]);
    await settle(el);
    expect(shadow(el).querySelector('.none')?.textContent).toBe('Click a file in the explorer to preview it here.');
  });
});
