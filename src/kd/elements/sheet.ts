import { css, html, nothing } from 'lit';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';

export interface SheetRow {
  key: string;
  value: Cell;
  /** In the grid layout, span every column. */
  wide?: boolean;
}

/** Rows in order, or a plain object (its keys in order). */
export type SheetData = SheetRow[] | Record<string, Cell>;

/**
 * A two-column property sheet. A row whose value is empty is left out.
 * `layout="grid"` lays the rows out as label-over-value tiles; `mono` sets
 * the keys in the monospace font.
 *
 * `el.data = [{ key: 'Node', value: 'node-1' }, { key: 'Phase', value: { text: 'Running', tone: 'success' } }]`
 */
export class KdSheet extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    layout: {},
    mono: { type: Boolean, reflect: true },
  };
  static override styles = [
    base,
    cellStyles,
    css`
      dl {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        margin: 0;
        font-size: 13px;
      }
      dt,
      dd {
        margin: 0;
        padding: 5px 12px 5px 0;
        border-bottom: 1px solid var(--kd-border, transparent);
      }
      dt {
        color: var(--kd-text-2, inherit);
      }
      dd {
        overflow-wrap: anywhere;
      }
      .mono dt {
        font-family: var(--kd-font-mono, monospace);
        font-size: 12px;
        color: var(--kd-text, inherit);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr));
        gap: 10px 24px;
        font-size: 13px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .label {
        margin-bottom: 2px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--kd-text-2, inherit);
      }
      .value {
        overflow-wrap: anywhere;
      }
    `,
  ];

  declare data: SheetData | undefined;
  declare layout: 'list' | 'grid' | undefined;
  declare mono: boolean;

  constructor() {
    super();
    this.mono = false;
  }

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object') return nothing;
    const all: SheetRow[] = Array.isArray(d) ? d : Object.entries(d).map(([key, value]) => ({ key, value }));
    const rows = all.filter((row) => row && !isEmpty(row.value));
    if (!rows.length) return nothing;
    if (this.layout === 'grid') {
      return html`<div class="grid">
        ${rows.map(
          (row) => html`<div class=${row.wide ? 'cell wide' : 'cell'}>
            <div class="label">${row.key}</div>
            <div class="value">${renderCell(row.value)}</div>
          </div>`,
        )}
      </div>`;
    }
    return html`<dl class=${this.mono ? 'mono' : ''}>
      ${rows.map((row) => html`<dt>${row.key}</dt><dd>${renderCell(row.value)}</dd>`)}
    </dl>`;
  }
}

define('kd-sheet', KdSheet);
