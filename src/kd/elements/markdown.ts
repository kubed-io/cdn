import { css, html, nothing, type PropertyValues } from 'lit';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { safeHref } from '../parts';
import './code';
import type { KdCode } from './code';

/** URL prefixes that relative links and images in the document resolve against. */
export interface MarkdownBase {
  links?: string;
  images?: string;
}

type Purify = typeof import('dompurify').default;
type Marked = import('marked').Marked;

// marked and DOMPurify each load once, on the first document, as their own chunks.
let parser: Promise<Marked> | undefined;
const purifiers = new WeakMap<Window, Promise<Purify>>();

function markdownParser(): Promise<Marked> {
  parser ??= import('marked').then((m) => new m.Marked({ gfm: true }));
  return parser;
}

function purifier(view: Window): Promise<Purify> {
  let found = purifiers.get(view);
  if (!found) {
    found = import('dompurify').then((m) => m.default(view as unknown as Parameters<Purify>[0]));
    purifiers.set(view, found);
  }
  return found;
}

// What DOMPurify keeps is HTML only (no SVG or MathML), without scripts and
// event handlers (its defaults), and without the tags and the style attribute
// that would let a document restyle or cover the panel, or post a form.
const SANITIZE = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'option', 'dialog', 'iframe', 'frame', 'object', 'embed'],
  FORBID_ATTR: ['style', 'action', 'formaction'],
  RETURN_DOM_FRAGMENT: true as const,
};

const UNSAFE_TAGS = new Set([
  ...SANITIZE.FORBID_TAGS,
  'script', 'noscript', 'template', 'svg', 'math', 'link', 'meta', 'base', 'frameset', 'applet', 'portal',
]);
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'background', 'cite', 'data', 'xlink:href']);

/**
 * A second pass over DOMPurify's output, which must already be clean: drops
 * any script-capable tag, event handler, style or script URL left in `root`.
 * It costs one walk, and it holds where DOMPurify cannot run properly (happy-dom,
 * whose NodeIterator loses its place on a removal, makes DOMPurify return
 * scripts untouched).
 */
export function scrub(root: Element | DocumentFragment): void {
  for (const el of [...root.querySelectorAll('*')]) {
    if (UNSAFE_TAGS.has(el.localName)) {
      el.remove();
      continue;
    }
    for (const { name, value } of [...el.attributes]) {
      const lower = name.toLowerCase();
      if (lower.startsWith('on') || lower === 'style' || lower === 'srcdoc') el.removeAttribute(name);
      else if (URL_ATTRS.has(lower) && /(^|,)\s*(javascript|vbscript|data):/i.test(value.replace(/[\0-\x20]/g, ''))) {
        if (!(lower === 'src' && el.localName === 'img' && /^\s*data:image\/(png|gif|jpe?g|webp);/i.test(value))) {
          el.removeAttribute(name);
        }
      }
    }
  }
}

// Already absolute, protocol-relative or an in-page anchor.
const ABSOLUTE = /^([a-z][a-z\d+.-]*:|\/\/|#)/i;

/**
 * `url` resolved against `base`, a URL prefix: `docs/a.md` and `/docs/a.md`
 * both land under it. Without a prefix, a document fetched from `from`
 * resolves the usual web way, against its own URL.
 */
export function rebase(url: string, base: string | undefined, from?: string): string {
  if ((!base && !from) || ABSOLUTE.test(url.trim())) return url;
  try {
    if (!base) return new URL(url, from).href;
    return new URL(url.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`).href;
  } catch {
    return url;
  }
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to dashes. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/**
 * Markdown, GitHub-flavoured (tables, task lists, autolinks), rendered by
 * marked and sanitised by DOMPurify before it reaches the shadow root. Code
 * fences render through `kd-code`; headings get anchors; links open in a new
 * tab. Relative links and images resolve against `base` (URL prefixes), or,
 * for a document fetched from `src`, against that URL.
 *
 * `<kd-markdown src="https://…/README.md"></kd-markdown>`, or `markdown` and
 * `base` set from afterRender.
 */
export class KdMarkdown extends KdElement {
  static override properties = {
    markdown: {},
    src: {},
    base: { converter: json },
  };
  static override styles = [
    base,
    css`
      .doc {
        font-size: 14px;
        line-height: 1.65;
        overflow-wrap: break-word;
      }
      .doc > :first-child {
        margin-top: 0;
      }
      .doc > :last-child {
        margin-bottom: 0;
      }
      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        margin: 1.4em 0 0.6em;
        font-weight: 600;
        line-height: 1.25;
      }
      h1,
      h2 {
        padding-bottom: 0.3em;
        border-bottom: 1px solid var(--kd-border, transparent);
      }
      h1 {
        font-size: 1.9em;
      }
      h2 {
        font-size: 1.5em;
      }
      h3 {
        font-size: 1.2em;
      }
      h4 {
        font-size: 1em;
      }
      h5,
      h6 {
        font-size: 0.9em;
      }
      h6 {
        color: var(--kd-text-2, inherit);
      }
      p,
      ul,
      ol,
      dl,
      table,
      blockquote,
      details,
      kd-code {
        margin: 0 0 1em;
      }
      ul,
      ol {
        padding-left: 2em;
      }
      li + li,
      li > ul,
      li > ol {
        margin-top: 0.25em;
      }
      li > ul,
      li > ol {
        margin-bottom: 0;
      }
      li:has(> input[type='checkbox']) {
        list-style: none;
      }
      li > input[type='checkbox'] {
        margin: 0 0.4em 0.2em -1.5em;
        vertical-align: middle;
      }
      a {
        color: var(--kd-link, inherit);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        padding: 0.15em 0.35em;
        border-radius: var(--kd-radius, 4px);
        background: var(--kd-bg-2, transparent);
        font-family: var(--kd-font-mono, monospace);
        font-size: 85%;
      }
      pre {
        padding: 12px 14px;
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 4px);
        background: var(--kd-canvas, transparent);
        overflow: auto;
      }
      pre code {
        padding: 0;
        background: none;
        font-size: 100%;
      }
      table {
        display: block;
        width: max-content;
        max-width: 100%;
        border-collapse: collapse;
        overflow: auto;
      }
      th,
      td {
        padding: 6px 13px;
        border: 1px solid var(--kd-border, transparent);
      }
      th {
        background: var(--kd-bg-2, transparent);
        font-weight: 600;
      }
      blockquote {
        padding: 0 1em;
        border-left: 4px solid var(--kd-border-strong, currentColor);
        color: var(--kd-text-2, inherit);
      }
      hr {
        height: 0;
        margin: 1.5em 0;
        border: 0;
        border-top: 1px solid var(--kd-border, transparent);
      }
      img {
        max-width: 100%;
        box-sizing: content-box;
      }
      summary {
        cursor: pointer;
      }
      .none {
        color: var(--kd-text-dim, inherit);
      }
      .raw {
        margin: 0;
        font-family: var(--kd-font-mono, monospace);
        font-size: 12.5px;
        white-space: pre-wrap;
      }
    `,
  ];

  declare markdown: string | undefined;
  declare src: string | undefined;
  declare base: MarkdownBase | undefined;

  #ticket = 0;
  #pending: Promise<void> | undefined;
  #doc: Node | undefined;

  /** Also waits for the document and the code in it to render. */
  protected override async getUpdateComplete(): Promise<boolean> {
    let done = await super.getUpdateComplete();
    while (this.#pending) {
      await this.#pending;
      done = await super.getUpdateComplete();
    }
    await Promise.all([...this.renderRoot.querySelectorAll<KdCode>('kd-code')].map((code) => code.updateComplete));
    return done;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('markdown') && !changed.has('src') && !changed.has('base')) return;
    const ticket = ++this.#ticket;
    const { markdown, src } = this;
    const linkBase = this.base?.links;
    const imageBase = this.base?.images;
    const job = async (): Promise<Node | undefined> => {
      if (typeof markdown === 'string') return this.#render(markdown, linkBase, imageBase);
      if (!src) return undefined;
      const view = this.ownerDocument.defaultView;
      const url = new URL(src, this.ownerDocument.baseURI).href;
      try {
        const response = await (view?.fetch ?? fetch)(url);
        if (!response.ok) return this.#note(`${response.status} ${src}`);
        const text = await response.text();
        if (ticket !== this.#ticket) return undefined;
        return this.#render(text, linkBase, imageBase, url);
      } catch {
        return this.#note(src);
      }
    };
    this.#pending = job().then((doc) => {
      if (ticket !== this.#ticket) return;
      this.#doc = doc;
      this.#pending = undefined;
      this.requestUpdate();
    });
  }

  #note(text: string): Node {
    const p = this.ownerDocument.createElement('p');
    p.className = 'none';
    p.textContent = text;
    return p;
  }

  async #render(markdown: string, links?: string, images?: string, from?: string): Promise<Node> {
    const doc = this.ownerDocument;
    const view = doc.defaultView;
    try {
      if (!view) throw new Error('no window');
      const [marked, purify] = await Promise.all([markdownParser(), purifier(view)]);
      // A DOMPurify that cannot run in this window hands its input back untouched.
      if (!purify.isSupported) throw new Error('DOMPurify is not supported here');
      // The leading newline costs nothing in a browser; without it happy-dom,
      // which the tests run in, drops the document's first element.
      const fragment = purify.sanitize(`\n${marked.parse(markdown, { async: false })}`, SANITIZE);
      const root = doc.createElement('div');
      root.className = 'doc';
      root.append(fragment);
      scrub(root);
      this.#finish(root, links, images, from);
      return root;
    } catch {
      // No renderer: the text itself, as text.
      const pre = doc.createElement('pre');
      pre.className = 'raw';
      pre.textContent = markdown;
      return pre;
    }
  }

  // Everything here works on the sanitised tree with DOM methods; nothing is
  // parsed as HTML again.
  #finish(root: HTMLElement, links?: string, images?: string, from?: string): void {
    const doc = this.ownerDocument;
    const ids = new Map<string, number>();
    for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      if (heading.id) continue;
      const id = slug(heading.textContent ?? '') || 'section';
      const n = ids.get(id) ?? 0;
      ids.set(id, n + 1);
      heading.id = n ? `${id}-${n}` : id;
    }
    const url = (el: Element, attr: string, prefix: string | undefined) => {
      const value = rebase(el.getAttribute(attr) ?? '', prefix, from);
      if (safeHref(value)) el.setAttribute(attr, value);
      else el.removeAttribute(attr);
    };
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.getAttribute('href')?.startsWith('#')) continue;
      url(a, 'href', links);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
    for (const img of root.querySelectorAll('img[src]')) url(img, 'src', images);
    for (const el of root.querySelectorAll('img[srcset], source[srcset]')) {
      const set = (el.getAttribute('srcset') ?? '')
        .split(',')
        .map((candidate) => {
          const [src, ...size] = candidate.trim().split(/\s+/);
          return [rebase(src, images, from), ...size].join(' ');
        })
        .filter((candidate) => safeHref(candidate));
      el.setAttribute('srcset', set.join(', '));
    }
    for (const input of root.querySelectorAll('input')) {
      if (input.type === 'checkbox') input.disabled = true;
      else input.remove();
    }
    for (const code of root.querySelectorAll('pre > code')) {
      const pre = code.parentElement as HTMLElement;
      const block = doc.createElement('kd-code') as KdCode;
      block.text = (code.textContent ?? '').replace(/\n$/, '');
      block.language = /(?:^|\s)language-(\S+)/.exec(code.className)?.[1];
      block.lines = false;
      pre.replaceWith(block);
    }
  }

  // An in-page anchor scrolls within the shadow root, where the page's own
  // fragment navigation cannot see.
  #click(event: MouseEvent): void {
    const a = (event.target as Element | null)?.closest?.('a[href^="#"]');
    if (!a) return;
    let id = a.getAttribute('href')!.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // as written
    }
    const target = (this.renderRoot as ShadowRoot).getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
  }

  override render() {
    return this.#doc ? html`<div @click=${(e: MouseEvent) => this.#click(e)}>${this.#doc}</div>` : nothing;
  }
}

define('kd-markdown', KdMarkdown);
