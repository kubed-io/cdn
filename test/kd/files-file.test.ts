import { afterEach, describe, expect, it } from 'vitest';

import '../../src/kd/files';
import { fileKind, looksBinary, type FileContent, type KdFile, type Provider } from '../../src/kd/files';
import { mount, settle, shadow, update } from './mount';

// kd-code and kd-markdown are only looked at as tags: what kd-file hands them.
type Code = HTMLElement & { text?: string; filename?: string };
type Markdown = HTMLElement & { markdown?: string; base?: unknown };

async function tick(el: KdFile): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
    await settle(el);
  }
}

async function file(props: Partial<KdFile>, markup = '<kd-file></kd-file>'): Promise<KdFile> {
  const el = await mount<KdFile>(markup);
  await update(el, props);
  await tick(el);
  return el;
}

const $ = <T extends Element = HTMLElement>(el: KdFile, selector: string) => shadow(el).querySelector(selector) as T | null;
const note = (el: KdFile) => $(el, '.none')?.textContent?.replace(/\s+/g, ' ').trim();

afterEach(() => {
  document.body.replaceChildren();
});

describe('fileKind', () => {
  it('reads a type first, then the extension, else leaves it to the content', () => {
    expect(fileKind('README.md')).toBe('markdown');
    expect(fileKind('docs/a.MDX')).toBe('markdown');
    expect(fileKind('logo.svg')).toBe('image');
    expect(fileKind('font.woff2')).toBe('binary');
    expect(fileKind('src/index.ts')).toBeUndefined();
    expect(fileKind('Dockerfile')).toBeUndefined();
    expect(fileKind('README', 'markdown')).toBe('markdown');
    expect(fileKind('x', 'text/markdown; charset=utf-8')).toBe('markdown');
    expect(fileKind('notes.md', 'text/plain')).toBe('markdown');
    expect(fileKind('x', 'image/png')).toBe('image');
    expect(fileKind('x.json', 'application/json')).toBe('code');
    expect(fileKind('x', 'application/vnd.api+json')).toBe('code');
    expect(fileKind('x', 'code')).toBe('code');
    expect(fileKind('x', 'application/pdf')).toBe('binary');
    expect(fileKind('x.ts', 'application/octet-stream')).toBeUndefined();
  });

  it('calls a NUL or mostly control characters binary', () => {
    expect(looksBinary('plain text\n\twith tabs')).toBe(false);
    expect(looksBinary('')).toBe(false);
    expect(looksBinary('PK\u0003\u0004\u0000')).toBe(true);
    expect(looksBinary('\u0001\u0002\u0003abc')).toBe(true);
    expect(looksBinary('���ab')).toBe(true);
  });
});

describe('kd-file', () => {
  it('says so when there is no file', async () => {
    const el = await file({});
    expect(note(el)).toBe('No file selected.');
    const custom = await file({}, '<kd-file empty="Pick a file"></kd-file>');
    expect(note(custom)).toBe('Pick a file');
  });

  it('shows code in kd-code, under a header with the path, size and links', async () => {
    const el = await file({
      path: 'src/kd/index.ts',
      text: 'export const x = 1;\n',
      links: [
        { text: 'GitHub', href: 'https://github.com/o/r/blob/abc/src/kd/index.ts', icon: '🐙' },
        { href: 'https://code.example.com/?folder=x', icon: '⌨', title: 'Open in code-server' },
        { text: 'bad', href: 'javascript:alert(1)' },
      ],
    });
    expect($(el, '.dirs')?.textContent).toBe('src/kd/');
    expect($(el, '.name')?.textContent).toBe('index.ts');
    expect($(el, '.meta')?.textContent).toBe('20 B');
    const links = [...shadow(el).querySelectorAll('.links a')] as HTMLAnchorElement[];
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('title')])).toEqual([
      ['🐙GitHub', 'https://github.com/o/r/blob/abc/src/kd/index.ts', '_blank', 'GitHub'],
      ['⌨', 'https://code.example.com/?folder=x', '_blank', 'Open in code-server'],
    ]);
    const code = $<Code>(el, 'kd-code');
    expect(code?.text).toBe('export const x = 1;\n');
    expect(code?.filename).toBe('index.ts');
  });

  it('renders markdown in kd-markdown with its bases', async () => {
    const base = { links: 'https://github.com/o/r/blob/abc/docs/', images: 'https://raw.githubusercontent.com/o/r/abc/docs/' };
    const el = await file({ path: 'docs/README.md', text: '# Hi', base });
    const md = $<Markdown>(el, 'kd-markdown');
    expect(md?.markdown).toBe('# Hi');
    expect(md?.base).toBe(base);
    expect($(el, 'kd-code')).toBeNull();

    await update(el, { type: 'code' });
    expect($(el, 'kd-markdown')).toBeNull();
    expect($<Code>(el, 'kd-code')?.text).toBe('# Hi');
  });

  it('shows an image from a blob, an SVG text or a URL', async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const el = await file({ path: 'img/logo.png', blob });
    const img = $<HTMLImageElement>(el, 'img.image');
    expect(img?.getAttribute('src')).toMatch(/^blob:/);
    expect(img?.getAttribute('alt')).toBe('logo.png');
    expect($(el, '.meta')?.textContent).toBe('4 B');

    const svg = await file({ path: 'icon.svg', text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' });
    const first = $(svg, 'img')?.getAttribute('src');
    expect(first).toMatch(/^blob:/);
    await update(svg, { links: [] });
    expect($(svg, 'img')?.getAttribute('src')).toBe(first);

    const remote = await file({ path: 'a.png', src: 'https://raw.githubusercontent.com/o/r/abc/a.png' });
    expect($(remote, 'img')?.getAttribute('src')).toBe('https://raw.githubusercontent.com/o/r/abc/a.png');
    const sneaky = await file({ path: 'a.png', src: 'javascript:alert(1)' });
    expect($(sneaky, 'img')).toBeNull();
  });

  it('summarises a binary file, whatever told it so', async () => {
    const byName = await file({ path: 'dist/app.wasm', size: 2048 });
    expect(note(byName)).toBe('A binary file with no text to show, 2.0 KiB.');
    const byText = await file({ path: 'data/blob', text: 'MZ\u0000\u0000\u0003' });
    expect(note(byText)).toContain('A binary file');
    expect($(byText, '.meta')?.textContent).toBe('5 B · binary');
    const byType = await file({ path: 'x', text: 'abc', type: 'application/pdf' });
    expect(note(byType)).toBe('A binary file with no text to show, 3 B (application/pdf).');
  });

  it('sniffs a blob of no known kind', async () => {
    const binary = await file({ path: 'a.dat2', blob: new Blob([new Uint8Array([1, 0, 2, 0])]) });
    expect(note(binary)).toContain('A binary file');
    const text = await file({ path: 'Makefile', blob: new Blob(['all:\n\techo hi\n']) });
    expect($<Code>(text, 'kd-code')?.text).toBe('all:\n\techo hi\n');
  });

  it('reads through a provider, showing the latest path only', async () => {
    const reads: string[] = [];
    const provider: Provider = {
      list: async () => [],
      read: (path) => {
        reads.push(path);
        return new Promise<FileContent>((resolve, reject) =>
          setTimeout(
            () => (path === 'gone.txt' ? reject(new Error('404 Not Found')) : resolve({ text: `body of ${path}`, size: 99 })),
            path === 'slow.ts' ? 30 : 1,
          ),
        );
      },
    };
    const el = await mount<KdFile>('<kd-file></kd-file>');
    await update(el, { provider, path: 'slow.ts' });
    expect(note(el)).toBe('Loading…');
    await update(el, { path: 'fast.ts' });
    await new Promise((r) => setTimeout(r, 50));
    await settle(el);
    expect($<Code>(el, 'kd-code')?.text).toBe('body of fast.ts');
    expect($(el, '.meta')?.textContent).toBe('99 B');

    await update(el, { path: 'gone.txt' });
    await tick(el);
    expect(note(el)).toBe('Could not read this file: 404 Not Found');

    await update(el, { text: 'given' });
    expect(reads).toEqual(['slow.ts', 'fast.ts', 'gone.txt']);
    expect($<Code>(el, 'kd-code')?.text).toBe('given');
  });

  it('notes a truncated file', async () => {
    const el = await file({ path: 'big.log', text: 'start' }, '<kd-file truncated></kd-file>');
    expect(note(el)).toBe('Only the start of this file was loaded.');
  });
});
