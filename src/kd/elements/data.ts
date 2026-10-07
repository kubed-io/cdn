import { css, html, nothing } from 'lit';

import { define } from '../define';
import { KdElement, base, json } from '../element';
import { yamlLines } from '../yaml';

/**
 * Any JSON value as YAML. An object or array longer than `fold` lines (default
 * 10; 0 never folds) collapses under a "{ } n keys" / "[ ] n items" line.
 *
 * `<kd-data data="{{kdjson spec}}" fold="20">`
 */
export class KdData extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    fold: { type: Number },
  };
  static override styles = [
    base,
    css`
      pre {
        margin: 0;
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .key {
        color: color-mix(in srgb, var(--kd-info, currentColor) 75%, var(--kd-text, currentColor));
      }
      .str {
        color: color-mix(in srgb, var(--kd-success, currentColor) 70%, var(--kd-text, currentColor));
      }
      .num {
        color: color-mix(in srgb, var(--kd-warning, currentColor) 55%, var(--kd-text, currentColor));
      }
      .bool,
      .null {
        color: color-mix(in srgb, var(--kd-primary, currentColor) 70%, var(--kd-text, currentColor));
      }
      summary {
        width: max-content;
        color: var(--kd-text-2, inherit);
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
        cursor: pointer;
        list-style: none;
      }
      summary::-webkit-details-marker {
        display: none;
      }
      summary::before {
        content: '▸ ';
      }
      details[open] > summary::before {
        content: '▾ ';
      }
      details > pre {
        margin-top: 2px;
      }
    `,
  ];

  declare data: unknown;
  declare fold: number;

  constructor() {
    super();
    this.fold = 10;
  }

  override render() {
    const value = this.data;
    if (value === undefined) return nothing;
    const lines = yamlLines(value);
    const pre = html`<pre>${lines.map(
      (line, i) =>
        html`${i ? '\n' : ''}${line.prefix}${line.tokens.map((t) =>
          t.kind === 'plain' ? t.text : html`<span class=${t.kind}>${t.text}</span>`,
        )}`,
    )}</pre>`;
    if (!(this.fold > 0 && lines.length > this.fold && value !== null && typeof value === 'object')) return pre;
    const n = Object.keys(value).length;
    const summary = Array.isArray(value) ? `[ ] ${n} item${n === 1 ? '' : 's'}` : `{ } ${n} key${n === 1 ? '' : 's'}`;
    return html`<details><summary>${summary}</summary>${pre}</details>`;
  }
}

define('kd-data', KdData);
