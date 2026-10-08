// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// marked, DOMPurify and highlight.js are lazy chunks: a panel that loads kd.js
// downloads none of them until it shows a document or code. So nothing kd/index.ts
// imports statically, however deep, may import them (or highlight.ts, which
// holds a loader for every highlight.js language).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LAZY = /^(marked|dompurify|highlight\.js)(\/|$)/;

// Static imports and re-exports; `import type` is erased, `import('…')` is lazy.
const STATIC = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;

function sourceGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(STATIC)) {
      if (!spec.startsWith('.')) {
        packages.add(spec);
        continue;
      }
      const base = resolve(dirname(file), spec);
      const found = [base, `${base}.ts`, join(base, 'index.ts')].find((f) => existsSync(f) && f.endsWith('.ts'));
      if (!found) throw new Error(`${file}: cannot resolve ${spec}`);
      visit(found);
    }
  };
  visit(entry);
  return { files, packages };
}

describe('the kd entry', () => {
  const { files, packages } = sourceGraph(join(ROOT, 'src/kd/index.ts'));

  it('reaches the elements and lit statically', () => {
    expect(files).toContain(join(ROOT, 'src/kd/elements/code.ts'));
    expect(files).toContain(join(ROOT, 'src/kd/elements/markdown.ts'));
    expect(packages).toContain('lit');
  });

  it('never statically imports marked, DOMPurify, highlight.js or the language table', () => {
    expect([...packages].filter((p) => LAZY.test(p))).toEqual([]);
    expect(files).not.toContain(join(ROOT, 'src/kd/highlight.ts'));
  });

  it('imports them on demand', () => {
    const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
    expect(read('src/kd/elements/code.ts')).toContain("import('../highlight')");
    expect(read('src/kd/elements/markdown.ts')).toContain("import('marked')");
    expect(read('src/kd/elements/markdown.ts')).toContain("import('dompurify')");
    expect(read('src/kd/highlight.ts')).toContain("import('highlight.js/lib/core')");
  });
});

// The same, on the build when there is one: what kd.js loads before any import().
const DIST = join(ROOT, 'dist');
const CHUNK = /(?:import|export)\s*(?:[\w$*{}\s,]*?from\s*)?["'](\.{1,2}\/[^"']+)["']/g;

describe.skipIf(!existsSync(join(DIST, 'kd.js')))('the built kd.js', () => {
  it('loads none of them statically', () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(CHUNK)) visit(resolve(dirname(file), spec));
    };
    visit(join(DIST, 'kd.js'));
    for (const file of seen) {
      const code = readFileSync(file, 'utf8');
      expect(code, `${file}: highlight.js`).not.toContain('highlightAuto');
      expect(code, `${file}: DOMPurify`).not.toMatch(/["'`]dompurify/);
      expect(code, `${file}: marked`).not.toContain('marked(): input parameter');
      expect(code, `${file}: highlight.js languages`).not.toMatch(/["'`]\.\/yaml\.js["'`]|es\/languages/);
    }
  });
});
