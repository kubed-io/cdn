import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';

import { define } from '../kd/define';
import { KdElement, base } from '../kd/element';
import { behaviours, brief, constraints } from './describe';
import { normalize, type Root, type SchemaNode } from './model';

const COMBINATORS = [
  ['anyOf', 'any of'],
  ['oneOf', 'exactly one of'],
  ['allOf', 'all of'],
] as const;

const words = (value: string | undefined): string[] => (value ?? '').split(/\s+/).filter(Boolean);
const clip = (value: unknown, max = 300): string => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
const safeUrl = (url: unknown): string | undefined =>
  typeof url === 'string' && /^https?:\/\//i.test(url) ? url : undefined;

/**
 * An OpenAPI v3 / JSON Schema viewer, written the way the YAML is: a field per
 * line with its type, constraints and Kubernetes behaviours beside it, a
 * required marker, and the description, rules and fields when opened. A
 * subtree is rendered only when it is opened.
 *
 * Data in: `document` (an OpenAPI document, a CRD or a schema) and `root` (see
 * `normalize`) as properties, or `src`, a URL returning the document.
 *
 * Attributes: `root`, `src`, `expand` (top-level fields open at first, default
 * `spec status`), `omit` (top-level fields left out, e.g. `apiVersion kind metadata`).
 */
export class KdSchema extends KdElement {
  static override properties = {
    document: { attribute: false },
    root: { attribute: 'root' },
    src: { attribute: 'src' },
    expand: { attribute: 'expand' },
    omit: { attribute: 'omit' },
    error: { state: true },
  };

  declare document: unknown;
  declare root: Root | undefined;
  declare src: string | undefined;
  declare expand: string | undefined;
  declare omit: string | undefined;
  declare error: string | undefined;

  #tree: SchemaNode | undefined;
  #open = new Map<SchemaNode, boolean>();
  #fetching = 0;

  static override styles = [
    base,
    css`
      :host {
        font-size: 13px;
      }
      .none {
        color: var(--kd-text-2, inherit);
        font-style: italic;
      }
      .f {
        margin-left: 16px;
      }
      .tree > .f {
        margin-left: 0;
      }
      summary,
      .leaf {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 2px 0;
        min-width: 0;
      }
      summary {
        cursor: pointer;
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary::before,
      .leaf::before {
        content: '';
        width: 10px;
        flex: none;
        color: var(--kd-text-2, inherit);
      }
      summary::before {
        content: '▸';
        transition: transform 0.1s;
      }
      details[open] > summary::before {
        transform: rotate(90deg);
      }
      summary:focus-visible {
        outline: 1px solid var(--kd-primary, currentColor);
        outline-offset: 1px;
      }
      .k,
      .t,
      .c,
      .mono {
        font-family: var(--kd-font-mono, monospace);
      }
      .k {
        font-weight: 500;
      }
      .rq {
        color: var(--kd-error, inherit);
        font-family: var(--kd-font-mono, monospace);
        margin-left: -6px;
      }
      .t {
        font-size: 12px;
        color: var(--kd-link, inherit);
        white-space: nowrap;
      }
      .kt {
        font-size: 11px;
        line-height: 1.4;
        padding: 0 6px;
        border: 1px solid var(--kd-border-strong, currentColor);
        border-radius: var(--kd-radius, 2px);
        color: var(--kd-primary, inherit);
        white-space: nowrap;
        cursor: help;
      }
      .c {
        font-size: 11px;
        color: var(--kd-text-2, inherit);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 55%;
        flex: none;
      }
      .ds {
        font-size: 12px;
        color: var(--kd-text-2, inherit);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
      }
      details[open] > summary .ds {
        visibility: hidden;
      }
      .fb {
        margin: 2px 0 6px 18px;
        padding: 4px 10px;
        border-left: 2px solid var(--kd-border, currentColor);
        font-size: 12px;
      }
      .fb > div {
        margin: 2px 0;
      }
      .desc {
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
      .dim,
      .sec {
        color: var(--kd-text-2, inherit);
      }
      .sec {
        margin: 10px 0 2px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .mono {
        overflow-wrap: anywhere;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px;
      }
      .tags .c {
        max-width: none;
        white-space: normal;
      }
      a {
        color: var(--kd-link, inherit);
      }
    `,
  ];

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('src') && this.src) void this.#fetch(this.src);
    if (changed.has('document') || changed.has('root')) {
      this.#tree = this.document === undefined ? undefined : normalize(this.document, this.root);
      this.#open = new Map();
    }
  }

  async #fetch(url: string): Promise<void> {
    const ticket = ++this.#fetching;
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const document = await response.json();
      if (ticket !== this.#fetching) return;
      this.error = undefined;
      this.document = document;
    } catch (e) {
      if (ticket === this.#fetching) this.error = `Could not load the schema: ${(e as Error).message ?? e}`;
    }
  }

  override render(): TemplateResult {
    if (this.error) return html`<div class="none">${this.error}</div>`;
    const omit = new Set(words(this.omit));
    const fields = (this.#tree?.fields ?? []).filter((f) => !omit.has(f.name));
    if (!fields.length) return html`<div class="none">No schema</div>`;
    return html`<div class="tree" part="tree">${fields.map((f) => this.#field(f, 0))}</div>`;
  }

  #isOpen(node: SchemaNode, depth: number): boolean {
    const set = this.#open.get(node);
    if (set !== undefined) return set;
    return depth === 0 && words(this.expand ?? 'spec status').includes(node.name);
  }

  #toggle(node: SchemaNode, event: Event): void {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    if (open === this.#open.get(node)) return;
    this.#open.set(node, open);
    this.requestUpdate();
  }

  #field(node: SchemaNode, depth: number): TemplateResult {
    const k = node.keywords;
    const c = constraints(k);
    const head = html`<span class="k">${node.name}</span>${node.required
        ? html`<span class="rq" title="required">*</span>`
        : nothing}<span class="t">${node.type}</span>${this.#tags(node)}${c.length
        ? html`<span class="c" title=${c.join('\n')}>${c.join(' · ')}</span>`
        : nothing}<span class="ds">${(k.description ?? '').split('\n')[0]}</span>`;
    const body = this.#body(node);
    if (!body.length && !node.expandable) return html`<div class="f leaf" title=${node.path}>${head}</div>`;
    const open = this.#isOpen(node, depth);
    return html`<details class="f" title=${node.path} ?open=${open} @toggle=${(e: Event) => this.#toggle(node, e)}>
      <summary>${head}</summary>
      ${open && body.length ? html`<div class="fb">${body}</div>` : nothing}
      ${open && node.expandable ? html`<div class="fc">${node.fields.map((f) => this.#field(f, depth + 1))}</div>` : nothing}
    </details>`;
  }

  #tags(node: SchemaNode): TemplateResult[] {
    return behaviours(node.keywords).map((b) => html`<span class="kt" title=${b.why}>${b.label}</span>`);
  }

  // Everything shown under an opened field besides its fields. Built for every
  // visible field (cheap: one node and its item/value schema), because a field
  // with nothing to open is drawn as a plain line.
  #body(node: SchemaNode): TemplateResult[] {
    const out: TemplateResult[] = [];
    const description = node.keywords.description;
    if (description) out.push(html`<div class="desc">${description}</div>`);
    out.push(...this.#extras(node));
    const cut = node.cycle ?? node.items?.cycle ?? node.values?.cycle;
    if (cut && cut.fields.length) {
      out.push(html`<div class="dim">
        the same type as ${cut.path ? html`<span class="mono">${cut.path}</span>` : 'the root'}, whose fields are listed there
      </div>`);
    }
    if (node.items) out.push(...this.#each('each item', node.items));
    if (node.values) out.push(...this.#each('each value', node.values));
    return out;
  }

  // What applies to each item of a list or each value of a map, besides its fields.
  #each(label: string, node: SchemaNode): TemplateResult[] {
    const c = constraints(node.keywords);
    const tags = this.#tags(node);
    const extras = this.#extras(node);
    if (!c.length && !tags.length && !extras.length) return [];
    return [
      html`<div class="sec">${label}</div>`,
      ...(c.length || tags.length
        ? [html`<div class="tags">${tags}${c.length ? html`<span class="c">${c.join(' · ')}</span>` : nothing}</div>`]
        : []),
      ...extras,
    ];
  }

  // Combinators, title, examples, docs, CEL rules, and every unknown keyword.
  #extras(node: SchemaNode): TemplateResult[] {
    const k = node.keywords;
    const out: TemplateResult[] = [];
    for (const [key, label] of COMBINATORS) {
      const branches = k[key];
      if (!Array.isArray(branches) || !branches.length) continue;
      // Kubernetes wraps every $ref in a one-member allOf; that is the type, not a rule.
      if (key === 'allOf' && branches.length === 1 && Object.keys(branches[0]).every((x) => x === '$ref')) continue;
      out.push(html`<div>
        <span class="dim">${label}:</span>
        ${branches.map((b, i) => html`${i ? html` <span class="dim">|</span> ` : nothing}${brief(b)}`)}
      </div>`);
    }
    if (k.not !== undefined) out.push(html`<div><span class="dim">must not be:</span> ${brief(k.not)}</div>`);
    if (k.title) out.push(html`<div><span class="dim">title</span> ${k.title}</div>`);
    if (k.example !== undefined) {
      out.push(html`<div><span class="dim">example</span> <span class="mono">${clip(k.example)}</span></div>`);
    }
    if (Array.isArray(k.examples)) {
      for (const example of k.examples) {
        out.push(html`<div><span class="dim">example</span> <span class="mono">${clip(example)}</span></div>`);
      }
    }
    // Only an http(s) URL becomes a link; anything else is shown as text.
    const docs = k.externalDocs;
    const url = safeUrl(docs?.url);
    if (docs && (docs.url || docs.description)) {
      out.push(html`<div>
        <span class="dim">docs</span>
        ${url
          ? html`<a href=${url} target="_blank" rel="noopener">${docs.description ?? url}</a>`
          : html`${docs.description ?? ''} <span class="mono">${docs.url ?? ''}</span>`}
      </div>`);
    }
    const rules = k['x-kubernetes-validations'];
    if (Array.isArray(rules) && rules.length) {
      out.push(html`<div class="sec">validation</div>`);
      for (const r of rules) {
        out.push(html`<div class="cel">
          <span class="mono">${r.rule ?? ''}</span>
          ${r.message
            ? html`<span class="dim">- ${r.message}</span>`
            : r.messageExpression
              ? html`<span class="dim">- message from</span> <span class="mono">${r.messageExpression}</span>`
              : nothing}
          ${r.reason ? html`<span class="dim">(${r.reason})</span>` : nothing}
          ${r.fieldPath ? html`<span class="dim">at</span> <span class="mono">${r.fieldPath}</span>` : nothing}
          ${r.optionalOldSelf ? html`<span class="dim">(checked on create too)</span>` : nothing}
        </div>`);
      }
    }
    const other = Object.entries(node.other);
    if (other.length) {
      out.push(html`<div class="sec">other</div>`);
      for (const [key, value] of other) {
        out.push(html`<div><span class="mono">${key}</span>: <span class="mono">${clip(value)}</span></div>`);
      }
    }
    return out;
  }
}

define('kd-schema', KdSchema);

declare global {
  interface HTMLElementTagNameMap {
    'kd-schema': KdSchema;
  }
}
