import { css, html, nothing } from 'lit';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';
import { renderIcon } from '../parts';

export interface BarData {
  /** An image URL or an emoji. */
  icon?: string;
  /** The line above the title, e.g. the kind and namespace. */
  eyebrow?: Cell;
  title: string;
  /** Pills beside the title. */
  chips?: Cell[];
  /** A breadcrumb at the far end, e.g. the owner chain. */
  chain?: Cell[];
}

/**
 * A title bar or masthead.
 *
 * `el.data = { icon: '🐘', eyebrow: 'StatefulSet', title: 'postgresql', chips: [{ text: '1/1', tone: 'success' }] }`
 */
export class KdBar extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  static override styles = [
    base,
    cellStyles,
    css`
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
        padding: 0 4px;
      }
      img.icon {
        width: 42px;
        height: 42px;
      }
      span.icon {
        font-size: 34px;
        line-height: 1;
      }
      .eyebrow {
        color: var(--kd-text-2, inherit);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .title {
        font-size: 22px;
        font-weight: 500;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }
      .grow {
        flex: 1;
      }
      .chain {
        font-size: 13px;
      }
      .sep {
        margin: 0 6px;
        color: var(--kd-text-dim, inherit);
      }
    `,
  ];

  declare data: BarData | undefined;

  override render() {
    const d = this.data;
    if (!d) return nothing;
    const chips = (d.chips ?? []).filter((c) => !isEmpty(c));
    const chain = (d.chain ?? []).filter((c) => !isEmpty(c));
    return html`<div class="bar">
      ${renderIcon(d.icon)}
      <div class="id">
        ${isEmpty(d.eyebrow) ? nothing : html`<div class="eyebrow">${renderCell(d.eyebrow)}</div>`}
        <div class="title">${d.title ?? ''}</div>
      </div>
      ${chips.length ? html`<div class="chips">${chips.map((c) => renderCell(c))}</div>` : nothing}
      <div class="grow"></div>
      ${chain.length
        ? html`<nav class="chain">
            ${chain.map((c, i) => html`${i ? html`<span class="sep">›</span>` : nothing}${renderCell(c)}`)}
          </nav>`
        : nothing}
    </div>`;
  }
}

define('kd-bar', KdBar);
