import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { renderIcon, safeHref } from '../parts';
import { basename, formatSize, normalizePath, type FileContent, type Provider } from './types';

/** A link in the header: GitHub, code-server and the like. `icon` is an image URL or an emoji. */
export interface FileLink {
  text?: string;
  href: string;
  icon?: string;
  title?: string;
}

/** Bases for a markdown file's relative links and images, as `kd-markdown` takes them. */
export interface MarkdownBase {
  links?: string;
  images?: string;
}

/** How a file is shown. */
export type FileKind = 'markdown' | 'code' | 'image' | 'binary';

const MARKDOWN = new Set(['md', 'markdown', 'mdown', 'mkd', 'mdx']);
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp', 'apng']);
const BINARY = new Set(
  (
    'zip gz tgz bz2 xz zst 7z rar tar jar war class pdf woff woff2 ttf otf eot exe dll so dylib a o wasm ' +
    'mp3 mp4 m4a mov avi mkv webm ogg wav flac psd sqlite db bin dat iso dmg pyc'
  ).split(' '),
);
const TEXTUAL = /^application\/(json|xml|javascript|ecmascript|x-javascript|yaml|x-yaml|toml|x-toml|sql|graphql|x-sh|x-shellscript|x-httpd-php|ld\+json)$|[+](json|xml|yaml)$/;
// Enough of a file to tell text from binary.
const SNIFF = 8000;

const extension = (path: string): string => {
  const name = basename(path).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : '';
};

/**
 * The kind a type or, failing that, the path's extension names. `type` is a
 * MIME type or a kind (`markdown`, `code`, `text`, `image`, `binary`).
 * Undefined means "look at the content".
 */
export function fileKind(path: string, type?: string | null): FileKind | undefined {
  const ext = extension(path);
  const t = String(type ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (t === 'markdown' || t === 'text/markdown' || t === 'text/x-markdown') return 'markdown';
  if (t === 'image' || t.startsWith('image/')) return 'image';
  if (t === 'binary') return 'binary';
  if (t === 'code' || t === 'text' || t.startsWith('text/') || TEXTUAL.test(t)) {
    return MARKDOWN.has(ext) && (t === 'text' || t === 'text/plain') ? 'markdown' : 'code';
  }
  if (t && t !== 'application/octet-stream') return 'binary';
  if (MARKDOWN.has(ext)) return 'markdown';
  if (IMAGE.has(ext)) return 'image';
  if (BINARY.has(ext)) return 'binary';
  return undefined;
}

/** Whether text decoded from a file looks binary: a NUL, or more than 10% control or undecodable characters. */
export function looksBinary(text: string): boolean {
  const sample = text.slice(0, SNIFF);
  if (!sample) return false;
  if (sample.includes('\u0000')) return true;
  let odd = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const c = sample.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 12 && c !== 13) || c === 0xfffd) odd += 1;
  }
  return odd / sample.length > 0.1;
}

/** A blob's text, or null when its bytes look binary. */
export async function blobText(blob: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.subarray(0, SNIFF).includes(0)) return null;
  const text = new TextDecoder('utf-8').decode(bytes);
  return looksBinary(text) ? null : text;
}

// An image source: a web or relative URL, an object URL, or an inline image.
const imageSrc = (src: string | undefined): string | undefined =>
  src && /^(https?:|blob:|data:image\/|\/|\.{0,2}\/|[^:]*$)/i.test(src.trim()) ? src : undefined;

/**
 * One file: a header (the path as a breadcrumb, the size, `links`), then the
 * file by its kind - markdown in `kd-markdown` (given `base`), text and code in
 * `kd-code`, images inline, anything else as a summary. The kind comes from
 * `type`, else the extension, else the content (a NUL byte or mostly control
 * characters is binary). Give it `text` or `blob` (or an image `src`), or a
 * `provider` and `path` and it reads the file itself.
 *
 * `<kd-file path="docs/README.md"></kd-file>` + `el.text = '# Hello'`
 */
export class KdFile extends KdElement {
  static override properties = {
    path: {},
    text: {},
    blob: { attribute: false },
    src: {},
    type: {},
    size: { type: Number },
    links: { attribute: 'links', converter: json },
    provider: { attribute: false },
    base: { attribute: false },
    truncated: { type: Boolean },
    empty: {},
  };
  static override styles = [
    base,
    css`
      :host {
        font-size: 13px;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 10px;
        padding: 2px 0 8px;
        border-bottom: 1px solid var(--kd-border, transparent);
        margin-bottom: 8px;
      }
      .path {
        min-width: 0;
        font-family: var(--kd-font-mono, monospace);
        overflow-wrap: anywhere;
      }
      .dirs,
      .meta,
      .none {
        color: var(--kd-text-dim, inherit);
      }
      .name {
        font-weight: 600;
      }
      .meta {
        font-size: 12px;
      }
      .links {
        display: inline-flex;
        gap: 10px;
        margin-left: auto;
      }
      .links a {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--kd-link, inherit);
        text-decoration: none;
      }
      .links a:hover {
        text-decoration: underline;
      }
      .icon {
        width: 16px;
        height: 16px;
      }
      img.image {
        display: block;
        max-width: 100%;
        height: auto;
      }
      .none {
        padding: 8px 0;
      }
    `,
  ];

  declare path: string | undefined;
  declare text: string | undefined;
  declare blob: Blob | undefined;
  declare src: string | undefined;
  declare type: string | undefined;
  declare size: number | undefined;
  declare links: FileLink[] | undefined;
  declare provider: Provider | undefined;
  declare base: MarkdownBase | undefined;
  declare truncated: boolean | undefined;
  declare empty: string | undefined;

  #read: FileContent | undefined;
  #reading = false;
  #error = '';
  #readTicket = 0;
  // What a blob of unknown kind decoded to: its text, or null for binary.
  #sniffed: { blob: Blob; text: string | null } | undefined;
  #url: { blob: Blob; url: string } | undefined;
  #svgText: { text: string; blob: Blob } | undefined;

  get #given(): boolean {
    return this.text !== undefined || this.blob !== undefined || !!this.src;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('provider') && !changed.has('path') && !changed.has('text') && !changed.has('blob') && !changed.has('src')) {
      return;
    }
    const ticket = ++this.#readTicket;
    this.#read = undefined;
    this.#error = '';
    this.#reading = false;
    const path = normalizePath(this.path);
    const provider = this.provider;
    if (this.#given || !path || typeof provider?.read !== 'function') return;
    this.#reading = true;
    let pending: Promise<FileContent>;
    try {
      pending = Promise.resolve(provider.read(path));
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(
      (content) => {
        if (ticket !== this.#readTicket) return;
        this.#read = content ?? {};
        this.#reading = false;
        this.requestUpdate();
      },
      (error: unknown) => {
        if (ticket !== this.#readTicket) return;
        this.#error = error instanceof Error ? error.message : String(error);
        this.#reading = false;
        this.requestUpdate();
      },
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#revoke();
  }

  #revoke(): void {
    if (this.#url) URL.revokeObjectURL(this.#url.url);
    this.#url = undefined;
  }

  #objectUrl(blob: Blob): string {
    if (this.#url?.blob !== blob) {
      this.#revoke();
      this.#url = { blob, url: URL.createObjectURL(blob) };
    }
    return this.#url.url;
  }

  // An SVG given as text, as one blob per text so its object URL is stable.
  #svg(text: string): Blob {
    if (this.#svgText?.text !== text) this.#svgText = { text, blob: new Blob([text], { type: 'image/svg+xml' }) };
    return this.#svgText.blob;
  }

  #sniff(blob: Blob): string | null | undefined {
    if (this.#sniffed?.blob === blob) return this.#sniffed.text;
    blobText(blob).then(
      (text) => {
        this.#sniffed = { blob, text };
        this.requestUpdate();
      },
      () => {
        this.#sniffed = { blob, text: null };
        this.requestUpdate();
      },
    );
    return undefined;
  }

  #header(path: string, size: number | undefined, kind: string): TemplateResult {
    const cut = path.lastIndexOf('/');
    const links = (Array.isArray(this.links) ? this.links : []).filter((l) => l && safeHref(l.href));
    return html`<div class="head">
      <span class="path"
        >${cut >= 0 ? html`<span class="dirs">${path.slice(0, cut + 1)}</span>` : nothing}<span class="name"
          >${path.slice(cut + 1)}</span
        ></span
      >
      ${size !== undefined || kind ? html`<span class="meta">${[size === undefined ? '' : formatSize(size), kind].filter(Boolean).join(' · ')}</span>` : nothing}
      ${links.length
        ? html`<span class="links">
            ${links.map(
              (l) => html`<a href=${safeHref(l.href) ?? ''} target="_blank" rel="noopener" title=${ifDefined(l.title ?? l.text)}
                >${renderIcon(l.icon)}${l.text ?? ''}</a
              >`,
            )}
          </span>`
        : nothing}
    </div>`;
  }

  override render() {
    const path = normalizePath(this.path);
    const read = this.#read ?? {};
    const text = this.text ?? read.text;
    const blob = this.blob ?? read.blob;
    const type = this.type ?? read.type ?? (blob?.type || undefined);
    const size = this.size ?? read.size ?? blob?.size ?? (text === undefined ? undefined : new TextEncoder().encode(text).length);
    if (!path && text === undefined && !blob && !this.src) {
      return html`<div class="none">${this.empty ?? 'No file selected.'}</div>`;
    }
    let kind = fileKind(path, type);
    let body: TemplateResult | typeof nothing = nothing;
    let content = text;
    if (this.#reading) body = html`<div class="none">Loading…</div>`;
    else if (this.#error) body = html`<div class="none">Could not read this file: ${this.#error}</div>`;
    else if (kind === 'image') {
      const image = blob ?? (content !== undefined && /^\s*</.test(content) ? this.#svg(content) : undefined);
      const src = image ? this.#objectUrl(image) : imageSrc(this.src);
      body = src
        ? html`<img class="image" src=${src} alt=${basename(path)} />`
        : html`<div class="none">An image with nothing to show.</div>`;
    } else if (content === undefined && blob && kind !== 'binary') {
      const sniffed = this.#sniff(blob);
      if (sniffed === undefined) body = html`<div class="none">Loading…</div>`;
      else if (sniffed === null) kind = 'binary';
      else content = sniffed;
    } else if (content !== undefined && kind === undefined && looksBinary(content)) kind = 'binary';

    if (body === nothing) {
      if (kind === 'binary' || content === undefined) {
        body = html`<div class="none">
          ${kind === 'binary' ? 'A binary file' : 'A file'} with no text to show${size === undefined ? '' : `, ${formatSize(size)}`}${type
            ? ` (${type})`
            : ''}.
        </div>`;
      } else if (kind === 'markdown') {
        body = html`<kd-markdown .markdown=${content} .base=${this.base}></kd-markdown>`;
      } else {
        body = html`<kd-code .text=${content} .filename=${basename(path)}></kd-code>`;
      }
    }
    const label = kind === 'binary' ? 'binary' : '';
    return html`${path ? this.#header(path, size, label) : nothing}${body}${this.truncated
      ? html`<div class="none">Only the start of this file was loaded.</div>`
      : nothing}`;
  }
}

define('kd-file', KdFile);
