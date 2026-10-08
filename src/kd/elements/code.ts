import { css, html, nothing, type PropertyValues } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { define } from '../define';
import { KdElement, base } from '../element';
import type { Highlighted } from '../highlight';

/** The highlighter, loaded on first use: language lookup by name or file name, and `highlight()`. */
export const highlighter = () => import('../highlight');

// Past either limit a file shows as plain text. highlight.js itself takes
// 25-50 ms on 200 KB of JSON or JavaScript (Node, 2026-10-08), but its markup
// is 2-5x the text and every token is a DOM node, so the page, not the
// highlighter, is what stalls on a bigger file.
const MAX_CHARS = 256 * 1024;
const MAX_LINES = 10_000;

/** A boolean attribute that can also be switched off: `lines="false"`. */
const flag = {
  fromAttribute: (value: string | null) => value !== null && value !== 'false' && value !== '0',
  toAttribute: (value: boolean) => (value ? '' : 'false'),
};

/** Line numbers from `"3,7-9"` (or `"L3-L9"`) or `[3, 7, 8, 9]`. */
export function lineSet(value: string | number | number[] | null | undefined): Set<number> {
  const out = new Set<number>();
  if (Array.isArray(value) || typeof value === 'number') {
    for (const n of [value].flat()) if (Number.isInteger(n)) out.add(n);
    return out;
  }
  for (const part of String(value ?? '').split(',')) {
    const m = /^\s*L?(\d+)\s*(?:-\s*L?(\d+)\s*)?$/i.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && out.size < MAX_LINES; n++) out.add(n);
  }
  return out;
}

// Newlines as \n, and no last empty line for the file's final newline.
const normal = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n$/, '');

/**
 * Source code with syntax colours from highlight.js, themed from `--kd-*`.
 * The language comes from `language` (a name or alias: `yaml`, `js`) or else
 * from `filename`; only that language's chunk loads, and an unknown one shows
 * as plain text. So does a file past 256 KB or 10,000 lines.
 *
 * `<kd-code filename="deploy.yaml" highlight="3,7-9"></kd-code>` with `text`
 * set from afterRender.
 */
export class KdCode extends KdElement {
  static override properties = {
    text: {},
    language: {},
    filename: {},
    lines: { converter: flag },
    wrap: { converter: flag },
    highlight: {},
    start: { type: Number },
  };
  static override styles = [
    base,
    css`
      :host {
        position: relative;
      }
      pre {
        margin: 0;
        padding: 8px 0;
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 4px);
        background: var(--kd-canvas, transparent);
        font-family: var(--kd-font-mono, monospace);
        font-size: 12.5px;
        line-height: 1.5;
        tab-size: 4;
        overflow: auto;
      }
      code {
        display: block;
        min-width: max-content;
        font: inherit;
      }
      .wrap code {
        min-width: 0;
      }
      .line {
        display: block;
        min-height: 1.5em;
        padding: 0 12px;
        white-space: pre;
      }
      .wrap .line {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .numbered .line {
        position: relative;
        padding-left: calc(var(--gutter) + 28px);
      }
      .numbered .line::before {
        position: absolute;
        left: 0;
        width: calc(var(--gutter) + 12px);
        color: var(--kd-text-dim, inherit);
        text-align: right;
        counter-increment: line;
        content: counter(line);
        user-select: none;
      }
      .hl {
        background: color-mix(in srgb, var(--kd-warning, transparent) 16%, transparent);
        box-shadow: inset 2px 0 var(--kd-warning, currentColor);
      }
      /* Above the numbered lines, which are positioned too and come later. */
      .tools {
        position: absolute;
        z-index: 1;
        top: 5px;
        right: 5px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px;
        border-radius: var(--kd-radius, 4px);
        background: color-mix(in srgb, var(--kd-bg-2, transparent) 85%, var(--kd-bg, transparent));
        opacity: 0;
        transition: opacity 0.15s;
      }
      :host(:hover) .tools,
      .tools:focus-within {
        opacity: 1;
      }
      .lang {
        margin-right: 2px;
        color: var(--kd-text-dim, inherit);
        font-size: 11px;
      }
      button {
        padding: 1px 7px;
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 4px);
        background: var(--kd-bg-2, transparent);
        color: var(--kd-text-2, inherit);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
      }
      button:hover,
      button[aria-pressed='true'] {
        border-color: var(--kd-border-strong, currentColor);
        color: var(--kd-text, inherit);
      }

      /* highlight.js scopes, onto the theme's tones as kd-data colours YAML */
      .hljs-keyword,
      .hljs-literal,
      .hljs-selector-tag,
      .hljs-name,
      .hljs-doctag {
        color: color-mix(in srgb, var(--kd-primary, currentColor) 75%, var(--kd-text, currentColor));
      }
      .hljs-string,
      .hljs-regexp,
      .hljs-char,
      .hljs-meta .hljs-string {
        color: color-mix(in srgb, var(--kd-success, currentColor) 70%, var(--kd-text, currentColor));
      }
      .hljs-number,
      .hljs-symbol,
      .hljs-bullet,
      .hljs-built_in,
      .hljs-type,
      .hljs-title.class_ {
        color: color-mix(in srgb, var(--kd-warning, currentColor) 60%, var(--kd-text, currentColor));
      }
      .hljs-title,
      .hljs-title.function_,
      .hljs-section {
        color: color-mix(in srgb, var(--kd-error, currentColor) 60%, var(--kd-text, currentColor));
      }
      .hljs-attr,
      .hljs-attribute,
      .hljs-property,
      .hljs-variable,
      .hljs-template-variable,
      .hljs-selector-attr,
      .hljs-selector-class,
      .hljs-selector-id,
      .hljs-selector-pseudo,
      .hljs-link {
        color: color-mix(in srgb, var(--kd-info, currentColor) 75%, var(--kd-text, currentColor));
      }
      .hljs-comment,
      .hljs-quote,
      .hljs-meta {
        color: var(--kd-text-dim, inherit);
      }
      .hljs-comment,
      .hljs-quote,
      .hljs-emphasis {
        font-style: italic;
      }
      .hljs-section,
      .hljs-strong {
        font-weight: 600;
      }
      .hljs-addition {
        background: color-mix(in srgb, var(--kd-success, transparent) 15%, transparent);
        color: color-mix(in srgb, var(--kd-success, currentColor) 70%, var(--kd-text, currentColor));
      }
      .hljs-deletion {
        background: color-mix(in srgb, var(--kd-error, transparent) 15%, transparent);
        color: color-mix(in srgb, var(--kd-error, currentColor) 70%, var(--kd-text, currentColor));
      }
      .hljs-subst,
      .hljs-params {
        color: inherit;
      }
    `,
  ];

  declare text: string | undefined;
  declare language: string | undefined;
  declare filename: string | undefined;
  declare lines: boolean;
  declare wrap: boolean;
  declare highlight: string | number[] | undefined;
  declare start: number;

  #key: string | undefined;
  #result: Highlighted | null = null;
  #pending: Promise<void> | undefined;
  #copied: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.lines = true;
    this.wrap = false;
    this.start = 1;
  }

  /** Also waits for the highlighting, so a test or a probe sees the coloured result. */
  protected override async getUpdateComplete(): Promise<boolean> {
    let done = await super.getUpdateComplete();
    while (this.#pending) {
      await this.#pending;
      done = await super.getUpdateComplete();
    }
    return done;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('text') && !changed.has('language') && !changed.has('filename')) return;
    const text = typeof this.text === 'string' ? normal(this.text) : '';
    const { language, filename } = this;
    const key = JSON.stringify([text, language, filename]);
    if (key === this.#key) return;
    this.#key = key;
    this.#result = null;
    this.#pending = undefined;
    if (!text || (!language && !filename) || text.length > MAX_CHARS || text.split('\n').length > MAX_LINES) return;
    this.#pending = highlighter()
      .then((m) => {
        const lang = m.languageOf(language) ?? m.languageOfFile(filename);
        return lang ? m.highlight(text, lang) : null;
      })
      .catch(() => null)
      .then((result) => {
        if (key !== this.#key) return;
        this.#result = result;
        this.#pending = undefined;
        this.requestUpdate();
      });
  }

  async #copy(): Promise<void> {
    const clipboard = this.ownerDocument.defaultView?.navigator?.clipboard;
    if (!clipboard || typeof this.text !== 'string') return;
    try {
      await clipboard.writeText(this.text);
    } catch {
      return;
    }
    clearTimeout(this.#copied);
    this.#copied = setTimeout(() => {
      this.#copied = undefined;
      this.requestUpdate();
    }, 1500);
    this.requestUpdate();
  }

  override render() {
    if (typeof this.text !== 'string') return nothing;
    const result = this.#result;
    const lines = result ? result.lines : normal(this.text).split('\n');
    const start = Number.isFinite(this.start) ? Math.trunc(this.start) : 1;
    const marks = lineSet(this.highlight);
    const cls = (i: number) => (marks.has(start + i) ? 'line hl' : 'line');
    // highlight.js's lines are its own escaped markup (see splitLines); plain
    // text goes through Lit as text.
    const body = result
      ? unsafeHTML(lines.map((line, i) => `<span class="${cls(i)}">${line}</span>`).join(''))
      : lines.map((line, i) => html`<span class=${cls(i)}>${line}</span>`);
    const gutter = String(start + lines.length - 1).length;
    const pre = [this.lines ? 'numbered' : '', this.wrap ? 'wrap' : ''].join(' ');
    return html`<div class="tools">
        ${result ? html`<span class="lang">${result.name}</span>` : nothing}
        <button type="button" aria-pressed=${this.wrap ? 'true' : 'false'} @click=${() => (this.wrap = !this.wrap)}>
          Wrap
        </button>
        <button type="button" @click=${() => this.#copy()}>${this.#copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre class=${pre} style="counter-reset: line ${start - 1}; --gutter: ${gutter}ch"><code>${body}</code></pre>`;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#copied);
    this.#copied = undefined;
  }
}

define('kd-code', KdCode);
