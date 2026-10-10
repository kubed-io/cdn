import { css, html, nothing } from 'lit';

import { cellStyles, isEmpty, renderCell, type Cell } from '../cell';
import { define } from '../define';
import { KdElement, base, json } from '../element';
import { renderIcon, tone, tones, type Tone } from '../parts';

export interface CardData {
  name?: string;
  /** An image URL or a short text such as an emoji. */
  icon?: string;
  /** Draws the left accent, the header dot and the state's colour. */
  tone?: Tone;
  /** After the name: pills, links, text. */
  cells?: Cell[];
  /** One large word in the tone (`Running`, `Waiting`), with `message` under it. */
  state?: string;
  message?: string;
}

/**
 * A bordered block: an optional tone accent, a header (dot, icon, name,
 * cells), an optional state line, then whatever it holds.
 *
 * `<kd-card data='{"name":"app","tone":"success","state":"Running"}'><kd-sheet …></kd-sheet></kd-card>`
 */
export class KdCard extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  static override styles = [
    base,
    tones,
    cellStyles,
    css`
      .card {
        padding: calc(var(--kd-space, 8px) * 1.25) calc(var(--kd-space, 8px) * 1.75);
        border: 1px solid var(--kd-border, transparent);
        border-radius: var(--kd-radius, 6px);
        background: var(--kd-bg-2, transparent);
      }
      .card.primary,
      .card.success,
      .card.warning,
      .card.error,
      .card.info,
      .card.neutral {
        border-left: 4px solid var(--tone);
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--tone);
        box-shadow: 0 0 6px var(--tone);
      }
      img.icon {
        width: 16px;
        height: 16px;
      }
      .name {
        margin-right: 6px;
        font-size: 14px;
        font-weight: 600;
      }
      .state {
        font-size: 18px;
        font-weight: 500;
        color: var(--tone-ink, inherit);
      }
      .message {
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--kd-text-2, inherit);
        overflow-wrap: anywhere;
      }
    `,
  ];

  declare data: CardData | undefined;

  override render() {
    const d = this.data ?? {};
    // Only a real tone counts; any other string means none.
    const t = d.tone && tone(d.tone, 'neutral') === d.tone ? d.tone : undefined;
    const cells = (Array.isArray(d.cells) ? d.cells : []).filter((c) => !isEmpty(c));
    const head = d.name || cells.length;
    return html`<article class=${t ? `card ${t}` : 'card'}>
      ${head
        ? html`<div class="head">
            ${t ? html`<span class="dot"></span>` : nothing} ${renderIcon(d.icon)}
            ${d.name ? html`<span class="name">${d.name}</span>` : nothing} ${cells.length ? renderCell(cells) : nothing}
          </div>`
        : nothing}
      ${d.state ? html`<div class="state">${d.state}</div>` : nothing}
      ${d.message ? html`<div class="message">${d.message}</div>` : nothing}
      <slot></slot>
    </article>`;
  }
}

define('kd-card', KdCard);
