import { describe, expect, it } from 'vitest';

import { highlight, languageOf, languageOfFile, languages, splitLines } from '../../src/kd/highlight';

describe('the highlighter', () => {
  it('has a chunk per language, without the .js.js duplicates', () => {
    const all = languages();
    expect(all).toContain('yaml');
    expect(all).toContain('javascript');
    expect(all.length).toBeGreaterThan(150);
    expect(all.some((name) => name.endsWith('.js'))).toBe(false);
  });

  it('resolves names and aliases', () => {
    expect(languageOf('yaml')).toBe('yaml');
    expect(languageOf('yml')).toBe('yaml');
    expect(languageOf('JS')).toBe('javascript');
    expect(languageOf('language-sh')).toBe('bash');
    expect(languageOf('html')).toBe('xml');
    expect(languageOf('no-such-language')).toBeUndefined();
    expect(languageOf('')).toBeUndefined();
  });

  it('resolves file names', () => {
    expect(languageOfFile('Dockerfile')).toBe('dockerfile');
    expect(languageOfFile('build/Dockerfile.dev')).toBe('dockerfile');
    expect(languageOfFile('Makefile')).toBe('makefile');
    expect(languageOfFile('src/app.ts')).toBe('typescript');
    expect(languageOfFile('main.tf')).toBe('ini');
    expect(languageOfFile('lib/common.jq')).toBe('bash');
    expect(languageOfFile('.github/workflows/ci.yml')).toBe('yaml');
    expect(languageOfFile('README.md')).toBe('markdown');
    expect(languageOfFile('.env')).toBe('ini');
    expect(languageOfFile('LICENSE')).toBeUndefined();
    expect(languageOfFile('a.unknownext')).toBeUndefined();
  });

  it('highlights into one escaped line of markup per line', async () => {
    const out = await highlight('a: "<b>"\n# note\nc: 1', 'yml');
    expect(out?.language).toBe('yaml');
    expect(out?.name).toBe('YAML');
    expect(out?.lines).toHaveLength(3);
    expect(out?.lines[0]).toContain('&lt;b&gt;');
    expect(out?.lines[0]).not.toContain('<b>');
    expect(out?.lines[1]).toContain('hljs-comment');
  });

  it('closes and reopens a span that crosses lines', async () => {
    const out = await highlight('/* one\ntwo */ x', 'javascript');
    expect(out?.lines).toEqual([
      '<span class="hljs-comment">/* one</span>',
      '<span class="hljs-comment">two */</span> x',
    ]);
  });

  it('loads what a language is built on', async () => {
    const out = await highlight('FROM alpine\nRUN echo "$HOME"', 'dockerfile');
    expect(out?.lines[1]).toContain('hljs-');
  });

  it('gives null for plain text and unknown languages', async () => {
    expect(await highlight('x', 'text')).toBeNull();
    expect(await highlight('x', 'no-such-language')).toBeNull();
  });

  it('refuses markup that is not highlight.js spans', () => {
    expect(splitLines('<span class="hljs-string">a</span>\nb')).toEqual(['<span class="hljs-string">a</span>', 'b']);
    expect(splitLines('<img src=x onerror=alert(1)>')).toBeNull();
    expect(splitLines('<span class="x" onclick="y">a</span>')).toBeNull();
    expect(splitLines('<span class="x">a')).toBeNull();
    expect(splitLines('a</span>')).toBeNull();
  });
});
