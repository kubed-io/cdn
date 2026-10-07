import { css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { define } from '../define';
import { KdElement, base } from '../element';
import { renderIcon, safeHref } from '../parts';

/**
 * The chat tile's header link: a large icon (an image URL or an emoji) over a
 * small label. An `http(s)` link opens in a new tab.
 *
 * `<kd-tile icon="🤖" label="Ask" href="https://…"></kd-tile>`
 */
export class KdTile extends KdElement {
  static override properties = { icon: {}, label: {}, href: {} };
  static override styles = [
    base,
    css`
      a,
      div {
        display: block;
        padding-top: 6px;
        color: inherit;
        text-align: center;
        text-decoration: none;
      }
      .icon {
        display: block;
        height: 30px;
        margin: 0 auto;
        font-size: 30px;
        line-height: 1;
      }
      .label {
        display: block;
        margin-top: 6px;
        color: var(--kd-text-2, inherit);
        font-size: 12px;
      }
    `,
  ];

  declare icon: string | undefined;
  declare label: string | undefined;
  declare href: string | undefined;

  override render() {
    const body = html`${renderIcon(this.icon)}<span class="label">${this.label ?? ''}</span>`;
    const href = safeHref(this.href);
    if (!href) return html`<div>${body}</div>`;
    const external = /^https?:/i.test(href);
    return html`<a
      href=${href}
      target=${ifDefined(external ? '_blank' : undefined)}
      rel=${ifDefined(external ? 'noopener' : undefined)}
      >${body}</a
    >`;
  }
}

define('kd-tile', KdTile);
