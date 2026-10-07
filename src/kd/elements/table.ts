import { css, html, nothing } from 'lit';

import { cellStyles, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';

export interface TableColumn {
  key: string;
  /** Defaults to the key. */
  label?: string;
  align?: 'left' | 'center' | 'right';
  /** Keep the cell on one line (counts, times, short pills). */
  nowrap?: boolean;
}

export interface TableData {
  /** Defaults to every key of the rows, in order of first appearance. */
  columns?: TableColumn[];
  rows: Record<string, Cell>[];
}

/**
 * A small table of cells. `data` may also be just the rows. With no rows it
 * shows `empty` (default "none").
 *
 * `el.data = { columns: [{ key: 'reason', label: 'Reason' }, { key: 'n', align: 'right' }], rows }`
 */
export class KdTable extends KdElement {
  static override properties = {
    data: { attribute: 'data', converter: json },
    empty: {},
  };
  static override styles = [
    base,
    cellStyles,
    css`
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th,
      td {
        padding: 6px 12px 6px 0;
        border-bottom: 1px solid var(--kd-border, transparent);
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--kd-text-2, inherit);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .center {
        text-align: center;
      }
      .right {
        text-align: right;
      }
      /* Prose breaks anywhere so one hash in a message cannot widen the table;
         links keep whole words and stop at 40ch with an ellipsis instead. */
      td {
        --kd-link-max: 40ch;
        overflow-wrap: anywhere;
      }
      .nowrap {
        white-space: nowrap;
      }
      .nowrap .cells {
        flex-wrap: nowrap;
      }
      .none {
        padding: 8px 0;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare data: TableData | TableData['rows'] | undefined;
  declare empty: string | undefined;

  override render() {
    const d = this.data;
    if (!d || typeof d !== 'object') return nothing;
    const { columns, rows = [] } = Array.isArray(d) ? { columns: undefined, rows: d } : d;
    if (!rows.length) return html`<div class="none">${this.empty ?? 'none'}</div>`;
    const cols = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))].map((key) => ({ key }) as TableColumn);
    const align = (col: TableColumn) => (col.align === 'right' || col.align === 'center' ? col.align : '');
    const cls = (col: TableColumn) => [align(col), col.nowrap ? 'nowrap' : ''].filter(Boolean).join(' ');
    return html`<table>
      <thead>
        <tr>
          ${cols.map((col) => html`<th class=${align(col)}>${col.label ?? col.key}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (row) => html`<tr>
            ${cols.map((col) => html`<td class=${cls(col)}>${renderCell(row?.[col.key])}</td>`)}
          </tr>`,
        )}
      </tbody>
    </table>`;
  }
}

define('kd-table', KdTable);
