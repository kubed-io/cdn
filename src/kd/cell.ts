// What a sheet value or a table cell may be, and how each shape renders.
import { css, html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import './elements/data';
import './elements/link';
import './elements/pill';
import type { Vars } from './elements/link';
import type { Tone } from './parts';

export type { Tone };

/** A pill: `<kd-pill>`. */
export interface PillCell {
  text: string;
  tone?: Tone;
  title?: string;
}

/** A plain link: `<kd-link>` with an `href`. */
export interface HrefCell {
  href: string;
  text: string;
  icon?: string;
  title?: string;
}

/** A dashboard link: `<kd-link>`. */
export interface DashboardCell {
  dashboard: string;
  vars?: Vars;
  text: string;
  icon?: string;
  title?: string;
  back?: boolean;
}

/** Any JSON value as YAML: `<kd-data>`. */
export interface DataCell {
  data: unknown;
}

/** Monospace text. */
export interface CodeCell {
  code: string;
}

/** A scalar is text; an array renders its cells inline, wrapped. */
export type Cell =
  | string
  | number
  | boolean
  | null
  | undefined
  | PillCell
  | HrefCell
  | DashboardCell
  | DataCell
  | CodeCell
  | Cell[];

/** Whether a cell has nothing to show. */
export function isEmpty(cell: Cell): boolean {
  return cell === null || cell === undefined || cell === '' || (Array.isArray(cell) && cell.every(isEmpty));
}

/** One cell. An object of no known shape is shown as data. */
export function renderCell(cell: Cell): TemplateResult | string | typeof nothing {
  if (cell === null || cell === undefined) return nothing;
  if (Array.isArray(cell)) {
    return html`<span class="cells">${cell.filter((c) => !isEmpty(c)).map((c) => html`<span>${renderCell(c)}</span>`)}</span>`;
  }
  if (typeof cell !== 'object') return String(cell);
  if ('dashboard' in cell || 'href' in cell) return html`<kd-link .data=${cell}></kd-link>`;
  if ('data' in cell) return html`<kd-data .data=${cell.data}></kd-data>`;
  if ('code' in cell) return html`<code>${String(cell.code)}</code>`;
  if ('text' in cell) {
    return html`<kd-pill tone=${ifDefined(cell.tone)} title=${ifDefined(cell.title)}>${String(cell.text)}</kd-pill>`;
  }
  return html`<kd-data .data=${cell}></kd-data>`;
}

/** Styles an element that renders cells adds to its own. */
export const cellStyles = css`
  .cells {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
  }
  code {
    font-family: var(--kd-font-mono, monospace);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
`;
