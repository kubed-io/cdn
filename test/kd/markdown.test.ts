import { afterEach, describe, expect, it, vi } from 'vitest';

import { rebase, slug, type KdCode, type KdMarkdown } from '../../src/kd';
import { scrub } from '../../src/kd/elements/markdown';
import { mount, settle, shadow, update } from './mount';

const $ = (el: Element, selector: string) => shadow(el).querySelector(selector);
const $$ = (el: Element, selector: string) => [...shadow(el).querySelectorAll(selector)];

async function render(markdown: string, props: Partial<KdMarkdown> = {}): Promise<KdMarkdown> {
  const el = await mount<KdMarkdown>(`<kd-markdown></kd-markdown>`);
  return update(el, { ...props, markdown });
}

describe('rebase and slug', () => {
  it('resolves relative URLs under a prefix and leaves absolute ones', () => {
    const base = 'https://github.com/o/r/blob/abc';
    expect(rebase('docs/a.md', base)).toBe('https://github.com/o/r/blob/abc/docs/a.md');
    expect(rebase('./docs/a.md', `${base}/`)).toBe('https://github.com/o/r/blob/abc/docs/a.md');
    expect(rebase('/docs/a.md', base)).toBe('https://github.com/o/r/blob/abc/docs/a.md');
    expect(rebase('../x.md', `${base}/docs`)).toBe('https://github.com/o/r/blob/abc/x.md');
    expect(rebase('https://example.com/a', base)).toBe('https://example.com/a');
    expect(rebase('mailto:a@example.com', base)).toBe('mailto:a@example.com');
    expect(rebase('#usage', base)).toBe('#usage');
    expect(rebase('docs/a.md', undefined)).toBe('docs/a.md');
    expect(rebase('img/a.png', undefined, 'https://h/repo/README.md')).toBe('https://h/repo/img/a.png');
  });

  it('slugs headings as GitHub does', () => {
    expect(slug('Getting Started!')).toBe('getting-started');
    expect(slug('  `kd-code` & friends ')).toBe('kd-code--friends');
    expect(slug('Über café')).toBe('über-café');
  });
});

describe('scrub', () => {
  it('drops what DOMPurify should have, wherever it is', () => {
    const root = document.createElement('div');
    root.innerHTML = [
      '<p onclick="x()" style="color: red" title="ok">a<script>x()</script></p>',
      '<a href=" java\tscript:x()">j</a><a href="data:text/html,x">d</a><a href="https://example.com">ok</a>',
      '<img src="data:image/png;base64,AAAA"><img src="data:text/html,x">',
      '<svg><a href="javascript:x()"></a></svg><template><b></b></template>',
    ].join('');
    scrub(root);
    expect(root.innerHTML).toBe(
      '<p title="ok">a</p><a>j</a><a>d</a><a href="https://example.com">ok</a><img src="data:image/png;base64,AAAA"><img>',
    );
  });
});

describe('kd-markdown', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders from the attribute and the property', async () => {
    const el = await mount<KdMarkdown>(`<kd-markdown markdown="# Hello"></kd-markdown>`);
    expect($(el, 'h1')?.textContent).toBe('Hello');
    await update(el, { markdown: 'Some *text*' });
    expect($(el, 'h1')).toBeNull();
    expect($(el, 'em')?.textContent).toBe('text');
  });

  it('renders GitHub-flavoured tables, task lists and autolinks', async () => {
    const el = await render(
      ['| a | b |', '|---|---|', '| 1 | 2 |', '', '- [x] done', '- [ ] todo', '', 'see https://example.com'].join('\n'),
    );
    expect($$(el, 'td').map((td) => td.textContent)).toEqual(['1', '2']);
    const boxes = $$(el, 'input') as HTMLInputElement[];
    expect(boxes.map((b) => [b.type, b.checked, b.disabled])).toEqual([
      ['checkbox', true, true],
      ['checkbox', false, true],
    ]);
    expect($(el, 'a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('strips scripts, event handlers, javascript: links and frames', async () => {
    const el = await render(
      [
        '<script>window.__pwned = 1</script>',
        '<img src="x.png" onerror="window.__pwned = 2">',
        '[click](javascript:alert(1)) <a href="javascript:alert(2)">raw</a>',
        '<iframe src="about:blank" srcdoc="<script>alert(5)</script>"></iframe>',
        '<style>* { display: none }</style>',
        '<p style="position: fixed" onclick="alert(3)">styled</p>',
        '<form action="/post"><input name="q"></form>',
        '<svg><script>alert(4)</script></svg>',
        '<object data="x.swf"></object><embed src="x.swf">',
      ].join('\n\n'),
    );
    const root = shadow(el);
    expect(root.querySelector('script, iframe, style, form, svg, object, embed')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
    for (const node of root.querySelectorAll('*')) {
      for (const attr of node.attributes) {
        expect(attr.name).not.toMatch(/^on/);
        expect(attr.value).not.toMatch(/javascript:/i);
      }
    }
    expect(root.querySelector('p[style]')).toBeNull();
    expect(root.querySelector('img')?.getAttribute('src')).toBe('x.png');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('renders code fences through kd-code with their language', async () => {
    const el = await render('```yaml\nkey: <b>1</b>\n```\n\n```\nplain\n```');
    const blocks = $$(el, 'kd-code') as KdCode[];
    expect(blocks.map((b) => [b.language, b.text, b.lines])).toEqual([
      ['yaml', 'key: <b>1</b>', false],
      [undefined, 'plain', false],
    ]);
    expect($(el, 'pre')).toBeNull();
    await settle(el);
    expect(shadow(blocks[0]).querySelector('.hljs-attr')).not.toBeNull();
    expect(shadow(blocks[0]).querySelector('b')).toBeNull();
  });

  it('gives headings unique anchors and scrolls to them in the shadow root', async () => {
    const el = await render('# Intro\n\n[go](#usage)\n\n## Usage\n\n## Usage');
    expect($$(el, 'h1, h2').map((h) => h.id)).toEqual(['intro', 'usage', 'usage-1']);
    const link = $(el, 'a') as HTMLAnchorElement;
    expect(link.getAttribute('target')).toBeNull();
    const target = $(el, '#usage') as HTMLElement;
    target.scrollIntoView = vi.fn();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
  });

  it('opens links in a new tab and resolves relative links and images against base', async () => {
    const el = await render('[docs](docs/a.md) [abs](https://example.com) ![logo](./img/logo.png)', {
      base: { links: 'https://github.com/o/r/blob/abc', images: 'https://raw.githubusercontent.com/o/r/abc/' },
    });
    const links = $$(el, 'a');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://github.com/o/r/blob/abc/docs/a.md',
      'https://example.com',
    ]);
    expect(links.every((a) => a.getAttribute('target') === '_blank' && a.getAttribute('rel') === 'noopener')).toBe(true);
    expect($(el, 'img')?.getAttribute('src')).toBe('https://raw.githubusercontent.com/o/r/abc/img/logo.png');
  });

  it('takes base from the attribute and rebases srcset', async () => {
    const el = await mount<KdMarkdown>(
      `<kd-markdown base='{"images":"https://cdn.example/r/"}'></kd-markdown>`,
    );
    await update(el, {
      markdown: '<picture><source srcset="dark.png 2x, https://x/y.png" media="(prefers-color-scheme: dark)"><img src="a.png"></picture>',
    });
    expect($(el, 'source')?.getAttribute('srcset')).toBe('https://cdn.example/r/dark.png 2x, https://x/y.png');
    expect($(el, 'img')?.getAttribute('src')).toBe('https://cdn.example/r/a.png');
  });

  it('fetches src and resolves against it', async () => {
    const fetch = vi.fn(async () => new Response('# Fetched\n\n![i](img/a.png)'));
    vi.stubGlobal('fetch', fetch);
    const el = await mount<KdMarkdown>(`<kd-markdown src="https://h.example/repo/README.md"></kd-markdown>`);
    expect(fetch).toHaveBeenCalledWith('https://h.example/repo/README.md');
    expect($(el, 'h1')?.textContent).toBe('Fetched');
    expect($(el, 'img')?.getAttribute('src')).toBe('https://h.example/repo/img/a.png');
  });

  it('says so when src cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const el = await mount<KdMarkdown>(`<kd-markdown src="https://h.example/missing.md"></kd-markdown>`);
    expect($(el, '.none')?.textContent).toBe('404 https://h.example/missing.md');
  });

  it('shows the latest markdown when renders overlap', async () => {
    const el = await mount<KdMarkdown>(`<kd-markdown></kd-markdown>`);
    el.markdown = '# One';
    await el.updateComplete;
    el.markdown = '# Two';
    el.markdown = '# Three';
    await el.updateComplete;
    expect($$(el, 'h1').map((h) => h.textContent)).toEqual(['Three']);
  });

  it('renders nothing without markdown', async () => {
    const el = await mount<KdMarkdown>(`<kd-markdown></kd-markdown>`);
    expect(shadow(el).children).toHaveLength(0);
  });
});
