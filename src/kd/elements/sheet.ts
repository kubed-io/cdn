import { css, html, nothing } from 'lit';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';

export interface SheetRow {
  key: string;
  value: Cell;
}

/** Rows in order, or a plain object (its keys in order). */
export type SheetData = SheetRow[] | Record<string, Cell>;

/**
 * A two-column property sheet. A row whose value is empty is left out.
 *
 * `el.data = [{ key: 'Node', value: 'puffer' }, { key: 'Phase', value: { text: 'Running', tone: 'success' } }]`
 */
export class KdSheet extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
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
    `,
  ];

  declare data: SheetData | undefined;

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object') return nothing;
    const rows = Array.isArray(d) ? d : Object.entries(d).map(([key, value]) => ({ key, value }));
    return html`<dl>
      ${rows
        .filter((row) => row && !isEmpty(row.value))
        .map((row) => html`<dt>${row.key}</dt><dd>${renderCell(row.value)}</dd>`)}
    </dl>`;
  }
}

define('kd-sheet', KdSheet);
